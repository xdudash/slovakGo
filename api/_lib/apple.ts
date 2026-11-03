import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";
import {
  Environment, NotificationTypeV2, OfferDiscountType, SignedDataVerifier, VerificationException,
  type JWSRenewalInfoDecodedPayload, type JWSTransactionDecodedPayload,
} from "@apple/app-store-server-library";
import { APPLE_ROOT_CA_G3 } from "./appleRootCa";
import { ensureCol, exec, fail, logEvent, nowIso, query, queryOne, requireUid, respond, rowToUser } from "./core";

export const APPLE_BUNDLE_ID = "sk.slovakgo.app";
/** Must match the auto-renewable subscriptions created in App Store Connect. */
export const APPLE_PRODUCT_IDS = ["sk.slovakgo.app.plus.monthly", "sk.slovakgo.app.plus.yearly"] as const;

export type AppleEntitlement = { status: "plus" | "trial" | "expired"; expiresAt: string | null };

/**
 * Access granted by one App Store subscription. Billing grace period keeps access
 * open like Stripe's past_due; a refund or revocation ends it immediately.
 */
export function appleEntitlement(tx: JWSTransactionDecodedPayload, renewal?: JWSRenewalInfoDecodedPayload | null, now = Date.now()): AppleEntitlement {
  if (tx.revocationDate) return { status: "expired", expiresAt: null };
  const until = Math.max(Number(tx.expiresDate ?? 0), Number(renewal?.gracePeriodExpiresDate ?? 0));
  if (!until) return { status: "expired", expiresAt: null };
  const expiresAt = new Date(until).toISOString();
  if (until <= now) return { status: "expired", expiresAt };
  return { status: tx.offerDiscountType === OfferDiscountType.FREE_TRIAL ? "trial" : "plus", expiresAt };
}

// ─── Signature verification ──────────────────────────────────────────────────
const verifiers = new Map<string, SignedDataVerifier>();
function verifierFor(environment: string): SignedDataVerifier {
  if (environment !== Environment.PRODUCTION && environment !== Environment.SANDBOX) {
    // Xcode StoreKit-configuration purchases are signed locally and can never be verified.
    throw new AppleVerificationError(`Unverifiable environment: ${environment || "unknown"}`);
  }
  let verifier = verifiers.get(environment);
  if (!verifier) {
    const appAppleId = Number(process.env.APPLE_APP_ID ?? "") || undefined;
    if (environment === Environment.PRODUCTION && !appAppleId) throw new Error("APPLE_APP_ID not configured");
    verifier = new SignedDataVerifier([Buffer.from(APPLE_ROOT_CA_G3, "base64")], true, environment as Environment, APPLE_BUNDLE_ID, appAppleId);
    verifiers.set(environment, verifier);
  }
  return verifier;
}
/** Picks the verifier from the unverified payload; the verifier then rejects a mismatched environment. */
function claimedEnvironment(jws: string, path: (payload: Record<string, unknown>) => unknown = (p) => p.environment): string {
  try {
    const payload = JSON.parse(Buffer.from(jws.split(".")[1] ?? "", "base64url").toString("utf8")) as Record<string, unknown>;
    return String(path(payload) ?? "");
  } catch { return ""; }
}
export async function verifyAppleTransaction(jws: string): Promise<JWSTransactionDecodedPayload> {
  return verifierFor(claimedEnvironment(jws)).verifyAndDecodeTransaction(jws);
}

// ─── Storage ─────────────────────────────────────────────────────────────────
async function ensureAppleTables(): Promise<void> {
  await exec(`CREATE TABLE IF NOT EXISTS apple_subscriptions (
    original_transaction_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, product_id TEXT NOT NULL,
    environment TEXT NOT NULL, status TEXT NOT NULL, expires_at TEXT, signed_at INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  )`);
  await exec("CREATE INDEX IF NOT EXISTS apple_subscriptions_user ON apple_subscriptions (user_id)");
  await ensureCol("users", "apple_account_token", "TEXT");
  await ensureCol("users", "apple_status", "TEXT");
  await ensureCol("users", "apple_expires_at", "TEXT");
}

export class AppleOwnershipError extends Error {}
export class AppleVerificationError extends Error {}

/**
 * Stores one verified transaction for `uid`. An App Store subscription belongs to
 * the first account it was linked to: a second account on the same Apple ID gets
 * AppleOwnershipError instead of free Plus.
 */
async function applyTransaction(uid: string, tx: JWSTransactionDecodedPayload, renewal?: JWSRenewalInfoDecodedPayload | null): Promise<AppleEntitlement> {
  const originalId = String(tx.originalTransactionId ?? "");
  if (!originalId || tx.bundleId !== APPLE_BUNDLE_ID || !APPLE_PRODUCT_IDS.includes(tx.productId as typeof APPLE_PRODUCT_IDS[number])) {
    throw new AppleVerificationError("Transaction is not a SlovakGO subscription");
  }
  const existing = await queryOne("SELECT user_id, signed_at FROM apple_subscriptions WHERE original_transaction_id = ? LIMIT 1", [originalId]);
  if (existing && String(existing.user_id) !== uid) throw new AppleOwnershipError("Apple subscription belongs to another account");
  const entitlement = appleEntitlement(tx, renewal);
  const signedAt = Number(tx.signedDate ?? 0);
  // Notifications and client uploads can arrive out of order; keep the newest state.
  if (!existing || signedAt >= Number(existing.signed_at ?? 0)) {
    await exec(
      `INSERT INTO apple_subscriptions (original_transaction_id, user_id, product_id, environment, status, expires_at, signed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(original_transaction_id) DO UPDATE SET product_id = excluded.product_id, status = excluded.status,
         expires_at = excluded.expires_at, signed_at = excluded.signed_at, updated_at = excluded.updated_at`,
      [originalId, uid, String(tx.productId), String(tx.environment ?? ""), entitlement.status, entitlement.expiresAt, signedAt, nowIso()]
    );
  }
  await refreshUserAppleStatus(uid);
  return entitlement;
}

/** Denormalises the best active App Store subscription onto the user row read by rowToUser. */
async function refreshUserAppleStatus(uid: string): Promise<void> {
  const rows = await query("SELECT status, expires_at FROM apple_subscriptions WHERE user_id = ?", [uid]);
  const active = rows
    .filter(r => r.status !== "expired" && Date.parse(String(r.expires_at ?? "")) > Date.now())
    .sort((a, b) => Date.parse(String(b.expires_at)) - Date.parse(String(a.expires_at)))[0];
  await exec("UPDATE users SET apple_status = ?, apple_expires_at = ?, updated_at = ? WHERE id = ?",
    [active ? String(active.status) : null, active ? String(active.expires_at) : null, nowIso(), uid]);
}

export async function deleteAppleSubscriptions(uid: string): Promise<void> {
  await ensureAppleTables();
  // Frees the Apple subscription so the learner can restore it into a new account.
  await exec("DELETE FROM apple_subscriptions WHERE user_id = ?", [uid]);
}

// ─── Routes ──────────────────────────────────────────────────────────────────
/** GET /billing/apple/account — the token StoreKit attaches to purchases made by this account. */
export async function handleAppleAccount(req: VercelRequest, res: VercelResponse): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  await ensureAppleTables();
  let row = await queryOne("SELECT apple_account_token FROM users WHERE id = ? LIMIT 1", [uid]);
  if (!row?.apple_account_token) {
    await exec("UPDATE users SET apple_account_token = ? WHERE id = ? AND apple_account_token IS NULL", [randomUUID(), uid]);
    row = await queryOne("SELECT apple_account_token FROM users WHERE id = ? LIMIT 1", [uid]);
  }
  respond(res, { appAccountToken: String(row?.apple_account_token ?? ""), productIds: APPLE_PRODUCT_IDS });
}

/** POST /billing/apple/transactions — signed transactions from a purchase or "Restore purchases". */
export async function handleAppleTransactions(req: VercelRequest, res: VercelResponse, body: any): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  const signed: unknown[] = Array.isArray(body?.signedTransactions) ? body.signedTransactions : [];
  if (!signed.length || signed.length > 20 || signed.some(s => typeof s !== "string" || s.length > 20_000)) {
    return fail(res, "Invalid transactions", 422);
  }
  await ensureAppleTables();
  const userRow = await queryOne("SELECT apple_account_token FROM users WHERE id = ? LIMIT 1", [uid]);
  const accepted: string[] = [];
  for (const jws of signed as string[]) {
    let tx: JWSTransactionDecodedPayload;
    try { tx = await verifyAppleTransaction(jws); } catch (err) {
      console.error("[apple] Rejected transaction:", err);
      return fail(res, "Не вдалося підтвердити покупку App Store", 422);
    }
    // A purchase made from another SlovakGO account carries that account's token.
    if (tx.appAccountToken && userRow?.apple_account_token && tx.appAccountToken !== String(userRow.apple_account_token)) {
      const owner = await queryOne("SELECT id FROM users WHERE apple_account_token = ? LIMIT 1", [tx.appAccountToken]);
      if (owner) return fail(res, "Ця підписка App Store вже прив’язана до іншого акаунта SlovakGO", 409);
    }
    try {
      const entitlement = await applyTransaction(uid, tx);
      if (entitlement.status !== "expired") await logEvent(uid, entitlement.status === "trial" ? "trial_start" : "paid", { source: "app_store", productId: tx.productId });
      accepted.push(String(tx.transactionId ?? ""));
    } catch (err) {
      if (err instanceof AppleOwnershipError) return fail(res, "Ця підписка App Store вже прив’язана до іншого акаунта SlovakGO", 409);
      if (err instanceof AppleVerificationError || err instanceof VerificationException) return fail(res, "Не вдалося підтвердити покупку App Store", 422);
      throw err;
    }
  }
  const user = await queryOne("SELECT * FROM users WHERE id = ? LIMIT 1", [uid]);
  respond(res, { ok: true, accepted, user: user ? rowToUser(user) : null });
}

/**
 * POST /billing/apple/notifications — App Store Server Notifications V2.
 * Renewals, expirations, grace period, refunds and revocations reach the server
 * here even when the learner never opens the app again.
 */
export async function handleAppleNotification(_req: VercelRequest, res: VercelResponse, body: any): Promise<void> {
  const signedPayload = typeof body?.signedPayload === "string" ? body.signedPayload : "";
  if (!signedPayload) return fail(res, "Missing signedPayload", 400);
  const environment = claimedEnvironment(signedPayload, (p) => (p.data as Record<string, unknown> | undefined)?.environment ?? (p.summary as Record<string, unknown> | undefined)?.environment);
  let notification;
  try {
    notification = await verifierFor(environment).verifyAndDecodeNotification(signedPayload);
  } catch (err) {
    console.error("[apple] Invalid notification:", err);
    return fail(res, "Invalid notification", 400);
  }
  await ensureAppleTables();
  const data = notification.data;
  if (notification.notificationType === NotificationTypeV2.TEST || !data?.signedTransactionInfo) return respond(res, { ok: true });

  const verifier = verifierFor(String(data.environment ?? environment));
  const tx = await verifier.verifyAndDecodeTransaction(data.signedTransactionInfo);
  const renewal = data.signedRenewalInfo ? await verifier.verifyAndDecodeRenewalInfo(data.signedRenewalInfo) : null;
  const linked = await queryOne("SELECT user_id FROM apple_subscriptions WHERE original_transaction_id = ? LIMIT 1", [String(tx.originalTransactionId ?? "")]);
  const owner = linked ?? (tx.appAccountToken ? await queryOne("SELECT id AS user_id FROM users WHERE apple_account_token = ? LIMIT 1", [tx.appAccountToken]) : null);
  // Unknown subscriptions get linked when the learner signs in and the app uploads them.
  if (!owner) return respond(res, { ok: true });

  const uid = String(owner.user_id);
  const before = await queryOne("SELECT status FROM apple_subscriptions WHERE original_transaction_id = ? LIMIT 1", [String(tx.originalTransactionId ?? "")]);
  const entitlement = await applyTransaction(uid, tx, renewal);
  if (notification.notificationType === NotificationTypeV2.DID_RENEW) await logEvent(uid, "paid", { source: "app_store", productId: tx.productId });
  if (entitlement.status === "expired" && before?.status !== "expired") await logEvent(uid, "churn", { reason: `app_store_${String(notification.notificationType).toLowerCase()}` });
  respond(res, { ok: true });
}
