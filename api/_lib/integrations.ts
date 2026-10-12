import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUid, checkRole, fail, respond, query, exec } from "./core";
import { inspectBillingPrice } from "./stripe";
export async function handleIntegrationHealth(req: VercelRequest, res: VercelResponse): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  if (!(await checkRole(uid, "admin"))) return fail(res, "Недостатньо прав", 403);
  const pricing = await Promise.all((["monthly", "yearly"] as const).map(plan => inspectBillingPrice(plan)));
  let deliveries: { id: string; status: string; createdAt: string }[] = [];
  let emailStatus = "not_configured";
  if (process.env.RESEND_API_KEY) {
    try {
      const response = await fetch("https://api.resend.com/emails?limit=20", { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, signal: AbortSignal.timeout(8000) });
      const body = await response.json() as { data?: Array<{ id: string; last_event: string; created_at: string }> };
      emailStatus = response.ok ? "verified" : `unverified:${response.status}`;
      deliveries = (body.data ?? []).map(e => ({ id: e.id, status: e.last_event, createdAt: e.created_at }));
    } catch { emailStatus = "unreachable"; }
  }
  await exec("CREATE TABLE IF NOT EXISTS lifecycle_runs (id TEXT PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT, sent INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0)");
  const runs = await query("SELECT * FROM lifecycle_runs ORDER BY started_at DESC LIMIT 10");
  const hasLogs = await query("SELECT name FROM sqlite_master WHERE type='table' AND name='email_deliveries'");
  const attempts = hasLogs.length ? await query("SELECT provider_id, status, created_at FROM email_deliveries ORDER BY created_at DESC LIMIT 20") : [];
  respond(res, { ok: true, pricing, email: { status: emailStatus, from: process.env.MAIL_FROM ?? "noreply@slovakgo.sk", cronConfigured: Boolean(process.env.CRON_SECRET), deliveries, attempts, runs } });
}
