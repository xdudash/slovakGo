/**
 * Vercel Cron — fires every hour.
 * Sends a reminder push notification to users who:
 *   1. Have `settings.reminderTime` set (HH:MM, treated as Europe/Bratislava time)
 *   2. Have not yet practiced today
 *   3. Have not already received a reminder today
 *   4. Have at least one FCM token registered
 *
 * Uses FCM V1 API with Service Account authentication.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type InValue } from "@libsql/client";
import { createSign } from "crypto";

type Arg = InValue;

let _db: ReturnType<typeof createClient> | null = null;
function getDb() {
  if (!_db) {
    if (!process.env.TURSO_DATABASE_URL) throw new Error("TURSO_DATABASE_URL is required");
    _db = createClient({
      url:       process.env.TURSO_DATABASE_URL,
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

// ─── FCM V1 Auth ──────────────────────────────────────────────────────────────

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

function base64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf) : buf;
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function makeJwt(sa: ServiceAccount): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss:   sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const sign = createSign("RSA-SHA256");
  sign.update(unsigned);
  const sig = base64url(sign.sign(sa.private_key));
  return `${unsigned}.${sig}`;
}

let _accessToken: string | null = null;
let _tokenExpiry = 0;

async function getAccessToken(sa: ServiceAccount): Promise<string | null> {
  if (_accessToken && Date.now() < _tokenExpiry) return _accessToken;
  try {
    const jwt = makeJwt(sa);
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    const d = await r.json() as { access_token?: string; expires_in?: number };
    if (!d.access_token) return null;
    _accessToken = d.access_token;
    _tokenExpiry = Date.now() + ((d.expires_in ?? 3600) - 60) * 1000;
    return _accessToken;
  } catch (err) {
    console.error("[fcm] Failed to get access token:", err);
    return null;
  }
}

async function sendFcmV1(tokens: string[], title: string, body: string, projectId: string, accessToken: string): Promise<number> {
  if (!tokens.length) return 0;
  let sent = 0;
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  // FCM V1 sends one message per token
  await Promise.all(tokens.map(async (token) => {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            data: { type: "reminder" },
            webpush: {
              notification: { icon: "/logosk.jpg", badge: "/logosk.jpg" },
            },
          },
        }),
      });
      if (r.ok) sent++;
      else {
        const err = await r.json();
        console.warn(`[fcm] Failed for token ${token.slice(0, 10)}...:`, err);
      }
    } catch (e) {
      console.error("[fcm] send error:", e);
    }
  }));

  return sent;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Vercel injects Authorization: Bearer <CRON_SECRET> on cron invocations.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    res.status(503).json({ ok: false, error: "CRON_SECRET not configured" });
    return;
  }
  if (req.headers["authorization"] !== `Bearer ${cronSecret}`) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }

  // Load Service Account
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "";
  if (!saJson) {
    res.status(200).json({ ok: true, skipped: "FIREBASE_SERVICE_ACCOUNT_JSON not configured" });
    return;
  }
  const sa = saJson ? safeJson<ServiceAccount>(saJson, {} as ServiceAccount) : null;
  if (!sa?.private_key || !sa?.client_email) {
    res.status(200).json({ ok: true, skipped: "Invalid service account JSON" });
    return;
  }

  const accessToken = await getAccessToken(sa);
  if (!accessToken) {
    res.status(200).json({ ok: false, error: "Could not get FCM access token" });
    return;
  }

  // Current hour in Europe/Bratislava
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

    const sent = await sendFcmV1(
      tokens,
      "SlovakGO — час практики! 🇸🇰",
      "Не забудь про свій урок сьогодні — тримай серію! 🔥",
      sa.project_id,
      accessToken,
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
