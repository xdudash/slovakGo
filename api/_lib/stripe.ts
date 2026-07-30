import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import {
  exec, queryOne, nowIso,
  requireUid, respond, fail, ensureCol
} from "./core";

let _stripe: Stripe | null = null;
const getStripe = () => _stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY ?? "", { apiVersion: "2026-06-24.dahlia" as Stripe.LatestApiVersion });

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
  
  const appUrl = String(process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    client_reference_id: uid,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/payment/success`,
    cancel_url:  `${appUrl}/payment/cancel`,
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
      params.subscription_data = { trial_period_days: 60 };
    }
  } else {
    params.customer_email = String(row.email);
    if (!hasUsedTrial) params.subscription_data = { trial_period_days: 60 };
  }
  
  const session = await getStripe().checkout.sessions.create(params);
  respond(res, { url: session.url });
}

export async function handleBillingPortal(req: VercelRequest, res: VercelResponse): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  const row = await queryOne("SELECT stripe_customer_id FROM users WHERE id = ? LIMIT 1", [uid]);
  const cusId = String(row?.stripe_customer_id ?? "");
  if (!cusId) return fail(res, "Billing account not found", 404);
  
  const appUrl  = String(process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
  const session = await getStripe().billingPortal.sessions.create({ customer: cusId, return_url: `${appUrl}/app/shop` });
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
    }
  }

  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const expiresAt = getSafeExpiresAt(sub.current_period_end);
    const status = sub.status === "trialing" ? "trial"
      : sub.status === "active" ? "plus"
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
  }

  if (event.type === "invoice.payment_failed") {
    const inv = event.data.object as Stripe.Invoice;
    const row = await queryOne("SELECT email, name_text FROM users WHERE stripe_customer_id = ? LIMIT 1", [String(inv.customer)]);
    if (row && process.env.RESEND_API_KEY) {
      const from    = process.env.MAIL_FROM ?? "noreply@slovakgo.sk";
      const appUrl  = String(process.env.APP_URL ?? "https://app.slovakgo.sk").replace(/\/$/, "");
      const html    = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f7ff;margin:0;padding:40px 20px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <h1 style="font-size:22px;font-weight:800;color:#1a1040;margin:0 0 4px;">SlovakGO</h1>
  <p style="color:#9ca3af;margin:0 0 32px;font-size:13px;">Вивчення словацької мови</p>
  <h2 style="font-size:18px;font-weight:700;color:#e93d45;margin:0 0 12px;">Помилка оплати підписки</h2>
  <p style="color:#374151;line-height:1.6;margin:0 0 24px;">Привіт, ${String(row.name_text)}! Не вдалося списати кошти за підписку SlovakGO Plus. Будь ласка, перевір або оновіть платіжні дані.</p>
  <a href="${appUrl}/app/shop" style="display:inline-block;background:#6c47ff;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;">Оновити дані оплати →</a>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
  <p style="color:#d1d5db;font-size:11px;margin:0;">© 2026 SlovakGO</p>
</div></body></html>`;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: String(row.email), subject: "Помилка оплати — SlovakGO Plus", html }),
      }).catch(err => console.error("[resend] billing email failed:", err));
    }
  }

  respond(res, { ok: true });
}
