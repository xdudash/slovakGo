import type { VercelRequest, VercelResponse } from "@vercel/node";
import { exec, getDb, requireUid, respond, fail, nowIso } from "./core";
export const SESSION_IDLE_MS = 5 * 60_000;
let ready: Promise<void> | undefined;
export function ensureActivity(): Promise<void> {
  return ready ??= (async () => {
    await exec(`CREATE TABLE IF NOT EXISTS activity_sessions (
      user_id TEXT NOT NULL, id TEXT NOT NULL, started_at TEXT NOT NULL,
      last_active_at TEXT NOT NULL, ended_at TEXT, active_seconds INTEGER NOT NULL DEFAULT 0,
      visits INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(user_id, id))`);
    await exec("CREATE INDEX IF NOT EXISTS activity_user_time ON activity_sessions(user_id, last_active_at)");
  })().catch(e => { ready = undefined; throw e; });
}
export async function closeIdleSessions(): Promise<void> {
  await ensureActivity();
  await exec("UPDATE activity_sessions SET ended_at = last_active_at WHERE ended_at IS NULL AND last_active_at < ?", [new Date(Date.now() - SESSION_IDLE_MS).toISOString()]);
}
export async function handleActivity(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  const id = String(body.sessionId ?? "");
  const seconds = Number(body.activeSeconds);
  const visits = Number(body.visits ?? 1);
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(id) || !Number.isSafeInteger(seconds) || seconds < 0 || seconds > 86400 || !Number.isSafeInteger(visits) || visits < 1 || visits > 10000) return fail(res, "Invalid activity", 422);
  await closeIdleSessions();
  const now = nowIso();
  // Cumulative reports are idempotent. Server elapsed time caps forged durations.
  // Updates from late heartbeats cannot reopen a session that timed out.
  const saved = await getDb().execute({
    sql: `INSERT INTO activity_sessions (user_id, id, started_at, last_active_at, ended_at, active_seconds, visits)
      VALUES (?, ?, ?, ?, ?, 0, 1)
      ON CONFLICT(user_id,id) DO UPDATE SET
        active_seconds = MAX(active_seconds, MIN(?, MAX(0, CAST((julianday(?) - julianday(started_at)) * 86400 AS INTEGER)))),
        visits = MAX(visits, ?), last_active_at = CASE WHEN ? THEN last_active_at ELSE ? END, ended_at = CASE WHEN ? THEN last_active_at ELSE NULL END
      WHERE activity_sessions.ended_at IS NULL`,
    args: [uid, id, now, now, body.ended ? now : null, seconds, now, visits, body.ended || body.idle ? 1 : 0, now, body.ended ? 1 : 0],
  });
  respond(res, { ok: true, closed: saved.rowsAffected === 0 });
}
