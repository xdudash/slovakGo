import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type Row, type InValue } from "@libsql/client";
import { SignJWT, jwtVerify } from "jose";

export const XP_PER_PRACTICE = 5;
export const LOGIN_MAX_ATTEMPTS = 10;
export const LOGIN_WINDOW_SEC = 900;
export const JWT_COOKIE = "sl_session";

// ─── DB ───────────────────────────────────────────────────────────────────────
let _db: ReturnType<typeof createClient> | null = null;
export function getDb() {
  if (!_db) {
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
const jwtKey = () => new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret-CHANGE-ME");
const isProd  = process.env.NODE_ENV === "production";

export async function signToken(uid: string): Promise<string> {
  return new SignJWT({ uid }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("30d").sign(jwtKey());
}
export async function verifyToken(token: string): Promise<string | null> {
  try { const { payload } = await jwtVerify(token, jwtKey()); return (payload.uid as string) ?? null; }
  catch { return null; }
}
export function setCookie(res: VercelResponse, token: string): void {
  res.setHeader("Set-Cookie", `${JWT_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 86400}${isProd ? "; Secure" : ""}`);
}
export function clearCookie(res: VercelResponse): void {
  res.setHeader("Set-Cookie", `${JWT_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
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
    subscriptionStatus: String(r.sub_status),
    trialEndsAt:        r.trial_ends ?? null,
    subExpiresAt:       r.sub_expires_at ?? null,
    onboardingDone:     Boolean(r.ob_done),
    settings:           safeJson(String(r.settings_j ?? "{}"), {}),
    hasUsedTrial:       Boolean(r.stripe_customer_id),
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
