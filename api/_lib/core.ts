import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type Row, type InValue } from "@libsql/client";
import { SignJWT, jwtVerify } from "jose";

export const XP_PER_PRACTICE = 5;
export const LOGIN_MAX_ATTEMPTS = 10;
export const LOGIN_WINDOW_SEC = 900;
export const JWT_COOKIE = "sl_session";

/**
 * Default settings for a freshly created user.
 * `reminderTime` must have a value here: the reminder cron only picks up users
 * who have one, so leaving it empty means they never get a push at all.
 */
export const DEFAULT_REMINDER_TIME = "19:00";
export const defaultSettingsJson = () => JSON.stringify({
  language: "uk",
  notificationsEnabled: true,
  soundEnabled: true,
  hapticsEnabled: true,
  reminderTime: DEFAULT_REMINDER_TIME,
});

// ─── DB ───────────────────────────────────────────────────────────────────────
let _db: ReturnType<typeof createClient> | null = null;
export function getDb() {
  if (!_db) {
    if (!process.env.TURSO_DATABASE_URL && process.env.NODE_ENV === "production") {
      throw new Error("TURSO_DATABASE_URL is required in production");
    }
    _db = createClient({
      url:       process.env.TURSO_DATABASE_URL ?? "file:./private/slovakgo.sqlite",
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _db;
}

export type Arg = InValue;

export async function query(sql: string, args: Arg[] = []): Promise<Row[]> {
  const r = await getDb().execute({ sql, args });
  return r.rows;
}
export async function queryOne(sql: string, args: Arg[] = []): Promise<Row | null> {
  return (await query(sql, args))[0] ?? null;
}
export async function exec(sql: string, args: Arg[] = []): Promise<void> {
  await getDb().execute({ sql, args });
}
export async function ensureCol(table: string, col: string, type: string): Promise<void> {
  try { await exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch { /* already exists */ }
}

/**
 * Records a funnel event server-side. Used for the money end of the funnel
 * (trial_start / paid / churn), which arrives via Stripe webhooks and must not
 * depend on the learner having a browser tab open.
 */
export async function logEvent(userId: string | null, name: string, props: Record<string, unknown> = {}): Promise<void> {
  try {
    await exec(
      `CREATE TABLE IF NOT EXISTS events (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         user_id TEXT, name TEXT NOT NULL,
         props_j TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL)`
    );
    await exec(
      "INSERT INTO events (user_id, name, props_j, created_at) VALUES (?, ?, ?, ?)",
      [userId, name, JSON.stringify(props).slice(0, 1000), nowIso()]
    );
  } catch (err) {
    console.error("[events] insert failed:", err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const nowIso  = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
export const todayKey = () => new Date().toISOString().slice(0, 10);

export function currentWeekId(): string {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function parseCookies(h: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of h.split(";")) {
    const i = pair.indexOf("=");
    if (i < 1) continue;
    out[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1).trim());
  }
  return out;
}

export function clientIp(req: VercelRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  return typeof fwd === "string" ? fwd.split(",")[0].trim() : "0.0.0.0";
}

export function safeJson<T>(s: string, fallback: T): T {
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

// ─── JWT / Cookie ─────────────────────────────────────────────────────────────
const jwtKey = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("JWT_SECRET is required in production");
  return new TextEncoder().encode(secret ?? "dev-secret-CHANGE-ME");
};
const isProd  = process.env.NODE_ENV === "production";

export async function signToken(uid: string): Promise<string> {
  return new SignJWT({ uid }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("30d").sign(jwtKey());
}
export async function verifyToken(token: string): Promise<string | null> {
  try { const { payload } = await jwtVerify(token, jwtKey()); return (payload.uid as string) ?? null; }
  catch { return null; }
}
export function setCookie(res: VercelResponse, token: string): void {
  const exp = new Date(Date.now() + 30 * 86400 * 1000).toUTCString();
  appendCookie(res, `${JWT_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 86400}; Expires=${exp}${isProd ? "; Secure" : ""}`);
}
export function clearCookie(res: VercelResponse): void {
  appendCookie(res, `${JWT_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}
function appendCookie(res: VercelResponse, cookie: string): void {
  const current = res.getHeader("Set-Cookie");
  const values = current === undefined ? [] : Array.isArray(current) ? current.map(String) : [String(current)];
  res.setHeader("Set-Cookie", [...values, cookie]);
}

// ─── response ─────────────────────────────────────────────────────────────────
export function respond(res: VercelResponse, data: unknown, status = 200): void {
  res.status(status).json(data);
}
export function fail(res: VercelResponse, msg: string, status = 400): void {
  res.status(status).json({ ok: false, error: msg });
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────
export async function getUid(req: VercelRequest): Promise<string | null> {
  const token = parseCookies(req.headers.cookie ?? "")[JWT_COOKIE];
  return token ? verifyToken(token) : null;
}
export async function requireUid(req: VercelRequest, res: VercelResponse): Promise<string | null> {
  const uid = await getUid(req);
  if (!uid) { fail(res, "Необхідна авторизація", 401); return null; }
  const user = await queryOne("SELECT is_blocked FROM users WHERE id = ? LIMIT 1", [uid]);
  if (!user || Boolean(user.is_blocked)) {
    clearCookie(res);
    fail(res, "Сесію завершено", 401);
    return null;
  }
  return uid;
}
export async function checkRole(uid: string, ...roles: string[]): Promise<boolean> {
  const row = await queryOne("SELECT role FROM users WHERE id = ? LIMIT 1", [uid]);
  return !!row && roles.includes(String(row.role));
}

// ─── DB models ────────────────────────────────────────────────────────────────
export async function ensureProgress(uid: string): Promise<Row> {
  let row = await queryOne("SELECT * FROM progress WHERE user_id = ? LIMIT 1", [uid]);
  if (!row) {
    await exec("INSERT OR IGNORE INTO progress (user_id, updated_at) VALUES (?, ?)", [uid, nowIso()]);
    row = await queryOne("SELECT * FROM progress WHERE user_id = ? LIMIT 1", [uid]);
  }
  return row!;
}

/**
 * Referral bonus days live in their own column so they never fight the Stripe
 * webhook, which overwrites sub_status/sub_expires_at on every invoice. While the
 * bonus is running the user is reported as "plus" to the app; the stored
 * sub_status stays truthful for the admin panel.
 */
function effectiveSubStatus(r: Row): string {
  const stored = String(r.sub_status);
  if (stored === "plus" || stored === "trial" || stored === "past_due") return stored;
  const bonusUntil = String(r.bonus_until ?? "");
  return bonusUntil && Date.parse(bonusUntil) > Date.now() ? "plus" : stored;
}

export function rowToUser(r: Row): Record<string, unknown> {
  return {
    id:                 String(r.id),
    email:              String(r.email),
    name:               String(r.name_text),
    role:               String(r.role),
    level:              String(r.level),
    goal:               r.goal ?? null,
    avatar:             r.avatar ?? null,
    country:            r.country ?? null,
    subscriptionStatus: effectiveSubStatus(r),
    bonusUntil:         r.bonus_until ?? null,
    trialEndsAt:        r.trial_ends ?? null,
    subExpiresAt:       r.sub_expires_at ?? null,
    onboardingDone:     Boolean(r.ob_done),
    settings:           safeJson(String(r.settings_j ?? "{}"), {}),
    hasUsedTrial:       Boolean(r.trial_used) || Boolean(r.stripe_customer_id),
    createdAt:          String(r.created_at),
    updatedAt:          String(r.updated_at),
  };
}

export async function getUserWords(uid: string): Promise<unknown[]> {
  const rows = await query("SELECT * FROM user_words WHERE user_id = ?", [uid]);
  return rows.map(r => ({
    userId: uid, wordId: String(r.word_id), status: String(r.status),
    mistakeCount: Number(r.mistakes), correctCount: Number(r.corrects),
    favorite: Boolean(r.favorite), lastSeenAt: r.last_seen ?? null,
  }));
}

export async function getLessons(role: string): Promise<unknown[]> {
  const sql = (role === "teacher" || role === "admin")
    ? "SELECT data_json FROM lessons ORDER BY rowid"
    : "SELECT data_json FROM lessons WHERE published = 1 ORDER BY rowid";
  return (await query(sql)).map(r => safeJson(String(r.data_json), null)).filter(Boolean);
}
