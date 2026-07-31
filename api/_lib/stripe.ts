import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import {
  exec, queryOne, nowIso, logEvent,
  requireUid, respond, fail, ensureCol
} from "./core";
import { appUrl, renderEmail, sendEmail } from "./mail";

let _stripe: Stripe | null = null;
const getStripe = () => _stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY ?? "", { apiVersion: "2026-06-24.dahlia" as Stripe.LatestApiVersion });

/**
 * Free days granted once per user on their first subscription.
 * Changing this also means changing the copy in the app (PaywallScreen, ShopScreen,
 * PathScreen, PaymentSuccess) and in the separate landing site under `landing/`.
 */
export const TRIAL_DAYS = 7;

/** Free Plus days the referrer earns when an invited learner actually pays. */
export const REFERRAL_BONUS_DAYS = 14;

export async function handleBillingCheckout(req: VercelRequest, res: VercelResponse): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  const priceId = process.env.STRIPE_PRICE_ID ?? "";
  if (!priceId) return fail(res, "STRIPE_PRICE_ID not configured", 503);
  
  await ensureCol("users", "sub_expires_at", "TEXT");
  await ensureCol("users", "stripe_customer_id", "TEXT");
  await ensureCol("users", "stripe_sub_id", "TEXT");
  await ensureCol("users", "trial_used", "INTEGER NOT NULL DEFAULT 0");
  
  const row = await queryOne(
    "SELECT email, stripe_customer_id, sub_status, stripe_sub_id, trial_used FROM users WHERE id = ? LIMIT 1",
    [uid]
  );
  if (!row) return fail(res, "User not found", 404);
  
  const base = appUrl();
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    client_reference_id: uid,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/payment/success`,
    cancel_url:  `${base}/payment/cancel`,
    allow_promotion_codes: true,
    metadata: { app_user_id: uid },
  };
  
  const cusId = String(row.stripe_customer_id ?? "");
  const hasActiveSub = String(row.stripe_sub_id ?? "") !== "";
  const hasUsedTrial = Boolean(row.trial_used) || Boolean(cusId);
  
  if (cusId) {
    (params as Record<string, unknown>).customer = cusId;
    // Даємо тріал тільки якщо у юзера ще ніколи не було підписки
    if (!hasActiveSub && !hasUsedTrial) {
      params.subscription_data = { trial_period_days: TRIAL_DAYS };
    }
  } else {
    params.customer_email = String(row.email);
    if (!hasUsedTrial) params.subscription_data = { trial_period_days: TRIAL_DAYS };
  }
  
  const session = await getStripe().checkout.sessions.create(params);
  respond(res, { url: session.url });
}

export async function handleBillingPortal(req: VercelRequest, res: VercelResponse): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  const row = await queryOne("SELECT stripe_customer_id FROM users WHERE id = ? LIMIT 1", [uid]);
  const cusId = String(row?.stripe_customer_id ?? "");
  if (!cusId) return fail(res, "Billing account not found", 404);
  
  const session = await getStripe().billingPortal.sessions.create({ customer: cusId, return_url: `${appUrl()}/app/shop` });
  respond(res, { url: session.url });
}

export async function handleBillingWebhook(req: VercelRequest, res: VercelResponse, rawBody: Buffer): Promise<void> {
  const secret = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  if (!secret) return fail(res, "Webhook secret not configured", 503);
  const sig = (req.headers["stripe-signature"] as string) ?? "";
  let event: Stripe.Event;
  
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("[webhook] Invalid signature:", err);
    return fail(res, "Invalid signature", 400);
  }

  await ensureCol("users", "trial_used", "INTEGER NOT NULL DEFAULT 0");


  function getSafeExpiresAt(periodEnd: unknown): string {
    if (typeof periodEnd === "number" && !isNaN(periodEnd)) return new Date(periodEnd * 1000).toISOString();
    if (typeof periodEnd === "string" && !isNaN(Number(periodEnd))) return new Date(Number(periodEnd) * 1000).toISOString();
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString();
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    if (s.client_reference_id && s.subscription) {
      let expiresAt: string;
      let trialEndsAt: string | null = null;
      let subscriptionStatus = "plus";
      try {
        const sub = await getStripe().subscriptions.retrieve(String(s.subscription));
        expiresAt = getSafeExpiresAt(sub.current_period_end);
        if (sub.status === "trialing") {
          subscriptionStatus = "trial";
          trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : expiresAt;
        }
      } catch (err) {
        console.error("Failed to retrieve subscription in webhook:", err);
        throw err;
      }
      
      await exec(
        "UPDATE users SET sub_status = ?, stripe_customer_id = ?, stripe_sub_id = ?, trial_ends = ?, trial_used = 1, sub_expires_at = ?, updated_at = ? WHERE id = ?",
        [subscriptionStatus, String(s.customer ?? ""), String(s.subscription), trialEndsAt, expiresAt, nowIso(), s.client_reference_id]
      );
      await logEvent(s.client_reference_id, subscriptionStatus === "trial" ? "trial_start" : "paid", { source: "checkout" });
    }
  }

  // Stripe fires this 3 days before a trial converts. With a 7-day trial that is
  // day 4 — early enough that nobody is surprised by the first charge.
  if (event.type === "customer.subscription.trial_will_end") {
    const sub = event.data.object as Stripe.Subscription;
    const row = await queryOne(
      "SELECT email, name_text FROM users WHERE stripe_customer_id = ? LIMIT 1",
      [String(sub.customer)]
    );
    if (row) {
      const endsAt = sub.trial_end
        ? new Date(sub.trial_end * 1000).toLocaleDateString("uk-UA", { day: "numeric", month: "long" })
        : "найближчими днями";
      await sendEmail(
        String(row.email),
        "Пробний період закінчується — SlovakGO Plus",
        renderEmail({
          title: "Через 3 дні почнеться підписка",
          paragraphs: [
            `Привіт, ${String(row.name_text)}! Твій пробний доступ до SlovakGO Plus закінчується ${endsAt}.`,
            "Після цього ми спишемо €9,99 за перший місяць, і всі рівні, практика та словник залишаться відкритими.",
            "Якщо продовжувати не плануєш — скасуй підписку в кабінеті, це займе хвилину і жодних списань не буде.",
          ],
          ctaText: "Керувати підпискою",
          ctaUrl: `${appUrl()}/app/shop`,
        })
      );
    }
  }

  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const expiresAt = getSafeExpiresAt(sub.current_period_end);
    const status = sub.status === "trialing" ? "trial"
      : sub.status === "active" ? "plus"
        // Stripe is still retrying — keep access open instead of locking the user
        // out on the first failed charge (most of these recover).
        : sub.status === "past_due" ? "past_due"
          : sub.status === "canceled" ? "cancelled" : "expired";
    const trialEndsAt = sub.status === "trialing" && sub.trial_end
      ? new Date(sub.trial_end * 1000).toISOString()
      : null;
    await exec(
      "UPDATE users SET sub_status = ?, trial_ends = ?, trial_used = 1, sub_expires_at = ?, updated_at = ? WHERE stripe_customer_id = ?",
      [status, trialEndsAt, expiresAt, nowIso(), String(sub.customer)]
    );
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    await exec(
      "UPDATE users SET sub_status = 'cancelled', stripe_sub_id = '', trial_ends = NULL, sub_expires_at = NULL, updated_at = ? WHERE stripe_customer_id = ?",
      [nowIso(), String(sub.customer)]
    );
    const churned = await queryOne("SELECT id FROM users WHERE stripe_customer_id = ? LIMIT 1", [String(sub.customer)]);
    if (churned) await logEvent(String(churned.id), "churn", { reason: "subscription_deleted" });
  }

  // Referral payout. Deliberately tied to a real payment rather than to signup:
  // rewarding at registration (the old behaviour) is farmable with throwaway accounts.
  if (event.type === "invoice.payment_succeeded" || event.type === "invoice.paid") {
    const inv = event.data.object as Stripe.Invoice;
    if (Number(inv.amount_paid ?? 0) > 0) {
      await ensureCol("users", "referral_rewarded", "INTEGER NOT NULL DEFAULT 0");
      await ensureCol("users", "bonus_until", "TEXT");

      const invitee = await queryOne(
        "SELECT id, name_text, referred_by, referral_rewarded FROM users WHERE stripe_customer_id = ? LIMIT 1",
        [String(inv.customer)]
      );
      const referrerId = String(invitee?.referred_by ?? "");
      if (invitee && referrerId && !Number(invitee.referral_rewarded ?? 0)) {
        const referrer = await queryOne(
          "SELECT email, name_text, bonus_until FROM users WHERE id = ? AND is_blocked = 0 LIMIT 1",
          [referrerId]
        );
        if (referrer) {
          // Extend from the current bonus end when it is still in the future, so
          // several successful invites stack instead of overwriting each other.
          const current = String(referrer.bonus_until ?? "");
          const from = current && Date.parse(current) > Date.now() ? new Date(current) : new Date();
          from.setDate(from.getDate() + REFERRAL_BONUS_DAYS);
          const until = from.toISOString().replace(/\.\d{3}Z$/, "Z");

          await exec("UPDATE users SET bonus_until = ?, updated_at = ? WHERE id = ?", [until, nowIso(), referrerId]);
          await exec("UPDATE users SET referral_rewarded = 1, updated_at = ? WHERE id = ?", [nowIso(), String(invitee.id)]);

          await sendEmail(
            String(referrer.email),
            `+${REFERRAL_BONUS_DAYS} днів Plus — дякуємо за запрошення`,
            renderEmail({
              title: `Тобі нараховано ${REFERRAL_BONUS_DAYS} днів Plus`,
              paragraphs: [
                `${String(referrer.name_text)}, друг, якого ти запросив, оформив підписку SlovakGO Plus.`,
                `Твій повний доступ подовжено до ${new Date(until).toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" })}.`,
                "Запрошуй далі — кожна оплата від запрошеного додає ще днів.",
              ],
              ctaText: "Продовжити навчання",
              ctaUrl: `${appUrl()}/app/path`,
            })
          );
        }
      }
    }
  }

  if (event.type === "invoice.payment_failed") {
    const inv = event.data.object as Stripe.Invoice;
    const row = await queryOne("SELECT email, name_text FROM users WHERE stripe_customer_id = ? LIMIT 1", [String(inv.customer)]);
    if (row) {
      await sendEmail(
        String(row.email),
        "Помилка оплати — SlovakGO Plus",
        renderEmail({
          title: "Помилка оплати підписки",
          accent: "#e93d45",
          paragraphs: [
            `Привіт, ${String(row.name_text)}! Не вдалося списати кошти за підписку SlovakGO Plus. Будь ласка, перевір або онови платіжні дані.`,
          ],
          ctaText: "Оновити дані оплати",
          ctaUrl: `${appUrl()}/app/shop`,
        })
      );
    }
  }

  respond(res, { ok: true });
}
