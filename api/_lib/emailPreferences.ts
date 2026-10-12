import { createHmac, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { exec, queryOne, requireUid, respond, fail, nowIso } from "./core";
import { appUrl } from "./mail";
let ready: Promise<void> | undefined;
export function ensureEmailPreferences(): Promise<void> {
  return ready ??= exec(`CREATE TABLE IF NOT EXISTS email_preferences (
    user_id TEXT PRIMARY KEY, marketing_consent INTEGER NOT NULL DEFAULT 0,
    consent_at TEXT, unsubscribed_at TEXT, updated_at TEXT NOT NULL)`)
    .catch(e => { ready = undefined; throw e; });
}
export async function saveConsent(uid: string, consent: boolean): Promise<void> {
  await ensureEmailPreferences();
  const now = nowIso();
  await exec(`INSERT INTO email_preferences (user_id, marketing_consent, consent_at, unsubscribed_at, updated_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET marketing_consent=excluded.marketing_consent,
    consent_at=excluded.consent_at, unsubscribed_at=excluded.unsubscribed_at, updated_at=excluded.updated_at`,
    [uid, consent ? 1 : 0, consent ? now : null, consent ? null : now, now]);
}
function signature(id: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET required for unsubscribe links");
  return createHmac("sha256", secret).update(`marketing-unsubscribe:${id}`).digest("hex");
}
export function unsubscribeUrl(uid: string): string {
  const id = Buffer.from(uid).toString("base64url");
  return `${appUrl()}/api/email/unsubscribe?token=${id}.${signature(id)}`;
}
export async function handleEmailPreferences(req: VercelRequest, res: VercelResponse, body?: Record<string, unknown>): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  await ensureEmailPreferences();
  if (body) {
    if (typeof body.marketingConsent !== "boolean") return fail(res, "Invalid consent", 422);
    await saveConsent(uid, body.marketingConsent);
  }
  const pref = await queryOne("SELECT marketing_consent FROM email_preferences WHERE user_id = ?", [uid]);
  respond(res, { ok: true, marketingConsent: Boolean(pref?.marketing_consent) });
}
export async function handleUnsubscribe(req: VercelRequest, res: VercelResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "https://localhost");
  const token = String(req.query.token ?? url.searchParams.get("token") ?? "");
  const [id, sig] = token.split(".");
  if (!id || !sig || !/^[a-zA-Z0-9_-]+$/.test(id) || !/^[a-f0-9]{64}$/.test(sig) || !timingSafeEqual(Buffer.from(sig), Buffer.from(signature(id)))) return fail(res, "Invalid unsubscribe link", 400);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "POST") {
    await saveConsent(Buffer.from(id, "base64url").toString(), false);
    res.status(200).send("<!doctype html><html lang=uk><meta charset=utf-8><title>SlovakGO</title><h1>Ви відписалися від маркетингових листів</h1><p>Листи про оплату й безпеку акаунта залишаються увімкненими.</p></html>");
  } else {
    res.status(200).send(`<!doctype html><html lang=uk><meta charset=utf-8><title>SlovakGO</title><h1>Відписатися від маркетингових листів?</h1><form method="post" action="?token=${token}"><button>Відписатися</button></form></html>`);
  }
}
