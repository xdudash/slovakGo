/**
 * Vercel Cron — fires every hour.
 * Sends a reminder push notification to users who:
 *   1. Have `settings.reminderTime` set (HH:MM, treated as Europe/Bratislava time)
 *   2. Have not yet practiced today
 *   3. Have not already received a reminder today
 *   4. Have at least one FCM token registered
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type InValue } from "@libsql/client";

type Arg = InValue;

let _db: ReturnType<typeof createClient> | null = null;
function getDb() {
  if (!_db) {
    _db = createClient({
      url:       process.env.TURSO_DATABASE_URL ?? "file:../../private/slovakgo.sqlite",
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _db;
}
async function query(sql: string, args: Arg[] = []) {
  return (await getDb().execute({ sql, args })).rows;
}
async function exec(sql: string, args: Arg[] = []) {
  await getDb().execute({ sql, args });
}
function safeJson<T>(s: string, fallback: T): T {
  try { return JSON.parse(s) as T; } catch { return fallback; }
}
const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

async function sendFcm(tokens: string[], title: string, body: string): Promise<number> {
  const serverKey = process.env.FIREBASE_SERVER_KEY;
  if (!serverKey || !tokens.length) return 0;

  let sent = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    try {
      const r = await fetch("https://fcm.googleapis.com/fcm/send", {
        method:  "POST",
        headers: { Authorization: `key=${serverKey}`, "Content-Type": "application/json" },
        body:    JSON.stringify({
          registration_ids: chunk,
          notification:     { title, body },
          data:             { type: "reminder" },
        }),
      });
      if (r.ok) {
        const d = await r.json() as { success?: number };
        sent += d.success ?? 0;
      }
    } catch { /* non-fatal */ }
  }
  return sent;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Vercel injects Authorization: Bearer <CRON_SECRET> on cron invocations.
  // In dev (no secret set) we allow the call through so it can be tested manually.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers["authorization"] !== `Bearer ${cronSecret}`) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }

  // Current hour in Europe/Bratislava (CET = UTC+1, CEST = UTC+2)
  const bratislavaHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Bratislava",
      hour:     "numeric",
      hour12:   false,
    }).format(new Date())
  );
  const today = new Date().toISOString().slice(0, 10);

  // Users who haven't practiced and haven't been reminded today
  const candidates = await query(
    `SELECT u.id, u.settings_j
     FROM users u JOIN progress p ON p.user_id = u.id
     WHERE u.is_blocked = 0
       AND (p.last_prac     IS NULL OR p.last_prac     != ?)
       AND (p.last_reminder_date IS NULL OR p.last_reminder_date != ?)`,
    [today, today]
  );

  // Filter by matching reminder hour in Bratislava timezone
  const toRemind = candidates.filter(r => {
    const s = safeJson<{ notificationsEnabled?: boolean; reminderTime?: string }>(
      String(r.settings_j ?? "{}"), {}
    );
    if (!s.notificationsEnabled || !s.reminderTime) return false;
    const [h] = s.reminderTime.split(":").map(Number);
    return h === bratislavaHour;
  });

  let totalSent = 0;
  let usersNotified = 0;

  for (const user of toRemind) {
    const userId = String(user.id);
    const tokenRows = await query("SELECT token FROM fcm_tokens WHERE user_id = ?", [userId]);
    const tokens = tokenRows.map(t => String(t.token));
    if (!tokens.length) continue;

    const sent = await sendFcm(
      tokens,
      "SlovakGO — час практики! 🇸🇰",
      "Не забудь про свій урок сьогодні — тримай серію! 🔥"
    );

    if (sent > 0) {
      await exec(
        "UPDATE progress SET last_reminder_date = ?, updated_at = ? WHERE user_id = ?",
        [today, nowIso(), userId]
      );
      usersNotified++;
      totalSent += sent;
    }
  }

  res.status(200).json({
    ok: true,
    bratislavaHour,
    candidates: candidates.length,
    usersNotified,
    totalSent,
  });
}
