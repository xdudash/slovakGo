/**
 * SlovakGO — Vercel Serverless API
 * Replaces public/api/index.php
 * Database: Turso (libsql, SQLite-compatible) via TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
 * Auth: JWT in HttpOnly cookie (replaces PHP sessions)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type Row, type InValue } from "@libsql/client";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import Stripe from "stripe";
import { createHash, randomBytes, randomUUID } from "node:crypto";

// ─── Constants ────────────────────────────────────────────────────────────────
const XP_PER_PRACTICE = 5;
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_SEC = 900;
const JWT_COOKIE = "sl_session";

// Disable Vercel's default JSON parser so we can read raw body for Stripe webhook
export const config = { api: { bodyParser: false } };

// ─── DB ───────────────────────────────────────────────────────────────────────
let _db: ReturnType<typeof createClient> | null = null;
function getDb() {
  if (!_db) {
    _db = createClient({
      url:       process.env.TURSO_DATABASE_URL ?? "file:./private/slovakgo.sqlite",
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _db;
}

type Arg = InValue;

async function query(sql: string, args: Arg[] = []): Promise<Row[]> {
  const r = await getDb().execute({ sql, args });
  return r.rows;
}
async function queryOne(sql: string, args: Arg[] = []): Promise<Row | null> {
  return (await query(sql, args))[0] ?? null;
}
async function exec(sql: string, args: Arg[] = []): Promise<void> {
  await getDb().execute({ sql, args });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const nowIso  = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const todayKey = () => new Date().toISOString().slice(0, 10);

function currentWeekId(): string {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function parseCookies(h: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of h.split(";")) {
    const i = pair.indexOf("=");
    if (i < 1) continue;
    out[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1).trim());
  }
  return out;
}

function clientIp(req: VercelRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  return typeof fwd === "string" ? fwd.split(",")[0].trim() : "0.0.0.0";
}

function safeJson<T>(s: string, fallback: T): T {
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

// ─── JWT / Cookie ─────────────────────────────────────────────────────────────
const jwtKey = () => new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret-CHANGE-ME");
const isProd  = process.env.NODE_ENV === "production";

async function signToken(uid: string): Promise<string> {
  return new SignJWT({ uid }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("30d").sign(jwtKey());
}
async function verifyToken(token: string): Promise<string | null> {
  try { const { payload } = await jwtVerify(token, jwtKey()); return (payload.uid as string) ?? null; }
  catch { return null; }
}
function setCookie(res: VercelResponse, token: string): void {
  res.setHeader("Set-Cookie", `${JWT_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 86400}${isProd ? "; Secure" : ""}`);
}
function clearCookie(res: VercelResponse): void {
  res.setHeader("Set-Cookie", `${JWT_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

// ─── CORS / response ──────────────────────────────────────────────────────────
function setCors(req: VercelRequest, res: VercelResponse): void {
  const origin  = (req.headers.origin as string) ?? "";
  const allowed = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://localhost:4173").split(",").map(s => s.trim());
  if (allowed.includes(origin) || (isProd && origin.startsWith("https://"))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
}

function respond(res: VercelResponse, data: unknown, status = 200): void {
  res.status(status).json(data);
}
function fail(res: VercelResponse, msg: string, status = 400): void {
  res.status(status).json({ ok: false, error: msg });
}

// ─── Body parsing ─────────────────────────────────────────────────────────────
async function readRaw(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────
async function getUid(req: VercelRequest): Promise<string | null> {
  const token = parseCookies(req.headers.cookie ?? "")[JWT_COOKIE];
  return token ? verifyToken(token) : null;
}
async function requireUid(req: VercelRequest, res: VercelResponse): Promise<string | null> {
  const uid = await getUid(req);
  if (!uid) { fail(res, "Необхідна авторизація", 401); return null; }
  return uid;
}
async function checkRole(uid: string, ...roles: string[]): Promise<boolean> {
  const row = await queryOne("SELECT role FROM users WHERE id = ? LIMIT 1", [uid]);
  return !!row && roles.includes(String(row.role));
}

// ─── DB helpers ───────────────────────────────────────────────────────────────
async function ensureProgress(uid: string): Promise<Row> {
  let row = await queryOne("SELECT * FROM progress WHERE user_id = ? LIMIT 1", [uid]);
  if (!row) {
    await exec("INSERT OR IGNORE INTO progress (user_id, updated_at) VALUES (?, ?)", [uid, nowIso()]);
    row = await queryOne("SELECT * FROM progress WHERE user_id = ? LIMIT 1", [uid]);
  }
  return row!;
}

function rowToUser(r: Row): Record<string, unknown> {
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
    onboardingDone:     Boolean(r.ob_done),
    settings:           safeJson(String(r.settings_j ?? "{}"), {}),
    createdAt:          String(r.created_at),
    updatedAt:          String(r.updated_at),
  };
}

async function getUserWords(uid: string): Promise<unknown[]> {
  const rows = await query("SELECT * FROM user_words WHERE user_id = ?", [uid]);
  return rows.map(r => ({
    userId: uid, wordId: String(r.word_id), status: String(r.status),
    mistakeCount: Number(r.mistakes), correctCount: Number(r.corrects),
    favorite: Boolean(r.favorite), lastSeenAt: r.last_seen ?? null,
  }));
}

async function getLessons(role: string): Promise<unknown[]> {
  const sql = (role === "teacher" || role === "admin")
    ? "SELECT data_json FROM lessons ORDER BY rowid"
    : "SELECT data_json FROM lessons WHERE published = 1 ORDER BY rowid";
  return (await query(sql)).map(r => safeJson(String(r.data_json), null)).filter(Boolean);
}

// ─── Route handlers ───────────────────────────────────────────────────────────

// GET /
async function handlePing(res: VercelResponse): Promise<void> {
  respond(res, { ok: true, updatedAt: nowIso() });
}

// POST /auth/register
async function handleRegister(_req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const email    = String(body.email ?? "").toLowerCase().trim();
  const password = String(body.password ?? "");
  const name     = String(body.name ?? "Студент").trim();
  const goal     = String(body.goal ?? "").trim();
  const cliId    = String(body.id ?? "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, "Некоректний email", 422);
  if (password.length < 6) return fail(res, "Пароль занадто короткий", 422);

  if (await queryOne("SELECT id FROM users WHERE email = ? LIMIT 1", [email]))
    return fail(res, "Email вже зареєстрований", 409);

  const id    = cliId || `user-${randomUUID()}`;
  const now   = nowIso();
  const trial = new Date(Date.now() + 14 * 86400_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const hash  = await bcrypt.hash(password, 11);
  const defS  = JSON.stringify({ language: "uk", notificationsEnabled: true, soundEnabled: true, hapticsEnabled: true });

  await exec(
    `INSERT INTO users (id, email, pw_hash, name_text, role, level, goal, sub_status, trial_ends, ob_done, settings_j, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'student', 'A0', ?, 'trial', ?, 0, ?, ?, ?)`,
    [id, email, hash, name, goal || null, trial, defS, now, now]
  );
  await ensureProgress(id);

  const row = await queryOne("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
  if (!row) return fail(res, "Помилка реєстрації", 500);

  setCookie(res, await signToken(id));
  respond(res, { ok: true, user: rowToUser(row) }, 201);
}

// POST /auth/login
async function handleLogin(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const ip  = clientIp(req);
  const win = new Date(Date.now() - LOGIN_WINDOW_SEC * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
  await exec("DELETE FROM login_attempts WHERE attempted_at < ?", [win]);

  const attempts = Number((await queryOne("SELECT COUNT(*) as c FROM login_attempts WHERE ip = ? AND attempted_at > ?", [ip, win]))?.c ?? 0);
  if (attempts >= LOGIN_MAX_ATTEMPTS) {
    res.setHeader("Retry-After", String(LOGIN_WINDOW_SEC));
    return fail(res, "Занадто багато спроб. Спробуй через 15 хвилин.", 429);
  }

  const email    = String(body.email ?? "").toLowerCase().trim();
  const password = String(body.password ?? "");
  const row      = await queryOne("SELECT * FROM users WHERE email = ? AND is_blocked = 0 LIMIT 1", [email]);
  const hash     = String(row?.pw_hash ?? "");
  const valid    = row && (hash === "DEV:skip" || await bcrypt.compare(password, hash));

  if (!valid) {
    await exec("INSERT INTO login_attempts (ip, attempted_at) VALUES (?, ?)", [ip, nowIso()]);
    return fail(res, "Невірний email або пароль", 401);
  }

  await exec("DELETE FROM login_attempts WHERE ip = ?", [ip]);
  setCookie(res, await signToken(String(row!.id)));
  respond(res, { ok: true, user: rowToUser(row!) });
}

// POST /auth/logout
async function handleLogout(res: VercelResponse): Promise<void> {
  clearCookie(res);
  respond(res, { ok: true });
}

// POST /auth/forgot
async function handleForgot(res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const email = String(body.email ?? "").toLowerCase().trim();
  const row   = await queryOne("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
  if (!row) return respond(res, { ok: true }); // don't leak existence

  const uid   = String(row.id);
  const token = randomBytes(32).toString("hex");
  const hash  = createHash("sha256").update(token).digest("hex");
  await exec("DELETE FROM password_resets WHERE user_id = ?", [uid]);
  await exec("INSERT INTO password_resets (token_hash, user_id, created_at, used) VALUES (?, ?, ?, 0)", [hash, uid, nowIso()]);

  const appUrl   = String(process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
  const resetUrl = `${appUrl}/reset-password?token=${token}`;
  const from     = process.env.MAIL_FROM ?? "noreply@slovakgo.sk";

  if (process.env.RESEND_API_KEY) {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f7ff;margin:0;padding:40px 20px;">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <h1 style="font-size:22px;font-weight:800;color:#1a1040;margin:0 0 4px;">SlovakGO</h1>
  <p style="color:#9ca3af;margin:0 0 32px;font-size:13px;">Вивчення словацької мови</p>
  <h2 style="font-size:18px;font-weight:700;color:#1a1040;margin:0 0 12px;">Скидання пароля</h2>
  <p style="color:#374151;line-height:1.6;margin:0 0 24px;">Натисни кнопку нижче, щоб встановити новий пароль. Посилання дійсне <strong>30 хвилин</strong>.</p>
  <a href="${resetUrl}" style="display:inline-block;background:#6c47ff;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;">Скинути пароль →</a>
  <p style="color:#9ca3af;font-size:12px;margin:28px 0 0;line-height:1.5;">Якщо ти не запитував скидання пароля — просто ігноруй цей лист. Твій пароль залишиться без змін.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
  <p style="color:#d1d5db;font-size:11px;margin:0;">© 2026 SlovakGO</p>
</div></body></html>`;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: email, subject: "Скидання пароля — SlovakGO", html }),
    });
    if (!r.ok) console.error("[resend] email send failed:", r.status, await r.text().catch(() => ""));
  } else {
    console.error("[password-reset] RESEND_API_KEY not set — reset URL:", resetUrl);
  }
  respond(res, { ok: true });
}

// POST /auth/reset
async function handleReset(res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const token    = String(body.token ?? "");
  const password = String(body.password ?? "");
  if (!token || password.length < 6) return fail(res, "Невалідний запит", 422);

  const hash = createHash("sha256").update(token).digest("hex");
  const row  = await queryOne("SELECT * FROM password_resets WHERE token_hash = ? AND used = 0 LIMIT 1", [hash]);
  if (!row) return fail(res, "Токен недійсний або вже використаний", 422);
  if (Date.now() - new Date(String(row.created_at)).getTime() > 30 * 60_000)
    return fail(res, "Токен застарів", 422);

  await exec("UPDATE users SET pw_hash = ?, updated_at = ? WHERE id = ?", [await bcrypt.hash(password, 11), nowIso(), String(row.user_id)]);
  await exec("UPDATE password_resets SET used = 1 WHERE token_hash = ?", [hash]);
  respond(res, { ok: true });
}

// POST /auth/delete
async function handleDeleteAccount(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const uid = await requireUid(req, res);
  if (!uid) return;
  const email = String(body.email ?? body.confirmEmail ?? "").toLowerCase().trim();
  const row   = await queryOne("SELECT email FROM users WHERE id = ? LIMIT 1", [uid]);
  if (!row || String(row.email) !== email) return fail(res, "Email не співпадає", 422);

  const db = getDb();
  await db.batch([
    { sql: "DELETE FROM user_words WHERE user_id = ?", args: [uid] },
    { sql: "DELETE FROM progress WHERE user_id = ?", args: [uid] },
    { sql: "DELETE FROM fcm_tokens WHERE user_id = ?", args: [uid] },
    { sql: "DELETE FROM sync_log WHERE user_id = ?", args: [uid] },
    { sql: "DELETE FROM users WHERE id = ?", args: [uid] },
  ]);
  clearCookie(res);
  respond(res, { ok: true });
}

// POST /auth/deactivate
async function handleDeactivate(req: VercelRequest, res: VercelResponse): Promise<void> {
  const uid = await requireUid(req, res);
  if (!uid) return;
  await exec("UPDATE users SET is_blocked = 1, updated_at = ? WHERE id = ?", [nowIso(), uid]);
  clearCookie(res);
  respond(res, { ok: true });
}

// GET /sync/pull
async function handleSyncPull(req: VercelRequest, res: VercelResponse): Promise<void> {
  const uid = await requireUid(req, res);
  if (!uid) return;

  let row = await queryOne("SELECT * FROM users WHERE id = ? LIMIT 1", [uid]);
  if (!row) return fail(res, "Користувача не знайдено", 404);

  // Auto-downgrade expired trials to free
  if (String(row.sub_status) === "trial" && row.trial_ends) {
    if (Date.now() > new Date(String(row.trial_ends)).getTime()) {
      await exec("UPDATE users SET sub_status = 'free', updated_at = ? WHERE id = ?", [nowIso(), uid]);
      row = await queryOne("SELECT * FROM users WHERE id = ? LIMIT 1", [uid]);
      if (!row) return fail(res, "Користувача не знайдено", 404);
    }
  }

  const prog  = await ensureProgress(uid);
  const words = await getUserWords(uid);
  const lessons = await getLessons(String(row.role));

  respond(res, {
    ok: true,
    user: rowToUser(row),
    progress: {
      userId:            uid,
      currentLevel:      String(row.level),
      completedLessons:  safeJson(String(prog.completed_j ?? "[]"), []),
      xpTotal:           Number(prog.xp_total),
      xpWeekly:          Number(prog.xp_weekly),
      xpDailyHistory:    safeJson(String(prog.xp_daily_j ?? "{}"), {}),
      hearts:            Number(prog.hearts),
      maxHearts:         Number(prog.max_hearts),
      streakDays:        Number(prog.streak_days),
      lastPracticeDate:  prog.last_prac || null,
      streakFreezeCount: Number(prog.freeze_cnt),
      coins:             Number(prog.coins),
      mistakes:          safeJson(String(prog.mistakes_j ?? "[]"), []),
      achievements:      [],
      updatedAt:         String(prog.updated_at),
    },
    userWords: words,
    lessons,
    updatedAt: nowIso(),
  });
}

// POST /sync/push
async function handleSyncPush(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const uid  = await requireUid(req, res);
  if (!uid) return;
  const muts = Array.isArray(body.mutations) ? body.mutations as Record<string, unknown>[] : [];
  let applied = 0;

  for (const mut of muts) {
    if (!mut.id) continue;
    const mutId = String(mut.id);
    if (await queryOne("SELECT 1 FROM sync_log WHERE mutation_id = ? LIMIT 1", [mutId])) continue;
    await processMutation(uid, mut);
    await exec("INSERT OR IGNORE INTO sync_log (mutation_id, user_id, type, processed_at) VALUES (?, ?, ?, ?)",
      [mutId, uid, String(mut.type ?? ""), nowIso()]);
    applied++;
  }
  respond(res, { ok: true, applied });
}

// ─── Mutations ────────────────────────────────────────────────────────────────
async function processMutation(uid: string, mut: Record<string, unknown>): Promise<void> {
  const type = String(mut.type ?? "");
  const p    = (typeof mut.payload === "object" && mut.payload) ? mut.payload as Record<string, unknown> : {};

  switch (type) {
    case "auth.register":     await mutAuthRegister(p); break;
    case "profile.update":    await mutProfileUpdate(uid, p); break;
    case "lesson.complete":   await mutLessonComplete(uid, p); break;
    case "exercise.wrong":    await mutExerciseWrong(uid, p); break;
    case "word.update":       await mutWordUpdate(uid, p); break;
    case "practice.complete": await mutPracticeComplete(uid, p); break;
    case "hearts.restore":    await exec("UPDATE progress SET hearts = max_hearts, updated_at = ? WHERE user_id = ?", [nowIso(), uid]); break;
    case "lesson.upsert":
      if (await checkRole(uid, "teacher", "admin")) await mutLessonUpsert(uid, p);
      break;
    case "lesson.delete":
      if (await checkRole(uid, "teacher", "admin") && p.lessonId)
        await exec("DELETE FROM lessons WHERE id = ?", [String(p.lessonId)]);
      break;
    case "admin.user.update":
      if (await checkRole(uid, "admin")) await mutAdminUserUpdate(p);
      break;
  }
}

async function mutAuthRegister(p: Record<string, unknown>): Promise<void> {
  const u = (typeof p.user === "object" && p.user) ? p.user as Record<string, unknown> : p;
  if (!u.id || !u.email) return;
  const id = String(u.id); const now = nowIso();
  await exec(
    `INSERT OR IGNORE INTO users (id, email, name_text, role, level, goal, sub_status, ob_done, settings_j, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, String(u.email).toLowerCase().trim(), String(u.name ?? ""), String(u.role ?? "student"),
     String(u.level ?? "A0"), u.goal ? String(u.goal) : null, String(u.subscriptionStatus ?? "trial"),
     u.onboardingDone ? 1 : 0, JSON.stringify(u.settings ?? {}), now, now]
  );
  await ensureProgress(id);
}

async function mutProfileUpdate(uid: string, p: Record<string, unknown>): Promise<void> {
  const sets: string[] = []; const vals: Arg[] = [];
  if ("name" in p)           { sets.push("name_text = ?");  vals.push(String(p.name ?? "").trim()); }
  if ("goal" in p)           { sets.push("goal = ?");       vals.push(p.goal ? String(p.goal) : null); }
  if ("level" in p)          { sets.push("level = ?");      vals.push(String(p.level)); }
  if ("avatar" in p)         { sets.push("avatar = ?");     vals.push(String(p.avatar)); }
  if ("country" in p)        { sets.push("country = ?");    vals.push(String(p.country)); }
  if ("onboardingDone" in p) { sets.push("ob_done = ?");    vals.push(p.onboardingDone ? 1 : 0); }
  if ("settings" in p)       { sets.push("settings_j = ?"); vals.push(JSON.stringify(p.settings)); }
  if (!sets.length) return;
  sets.push("updated_at = ?"); vals.push(nowIso()); vals.push(uid);
  await exec(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, vals);
}

async function mutLessonComplete(uid: string, p: Record<string, unknown>): Promise<void> {
  const lessonId = String(p.lessonId ?? "");
  const answers  = Array.isArray(p.answers) ? p.answers as Record<string, unknown>[] : [];
  const wrong    = answers.filter(a => !a.correct).length;
  const xpEarned = Math.max(10, answers.length > 0 ? answers.length * 5 - wrong * 3 : 10);

  const prog   = await ensureProgress(uid);
  const today  = todayKey();
  const weekId = currentWeekId();
  const xpW    = String(prog.week_id) === weekId ? Number(prog.xp_weekly) : 0;
  const lastP  = String(prog.last_prac ?? "");
  let streak   = Number(prog.streak_days);

  if (lastP !== today) {
    if (!lastP) streak = 1;
    else { const yest = new Date(Date.now() - 86400_000).toISOString().slice(0, 10); streak = lastP === yest ? streak + 1 : 1; }
  }

  const xpDaily: Record<string, number> = safeJson(String(prog.xp_daily_j ?? "{}"), {});
  xpDaily[today] = (xpDaily[today] ?? 0) + xpEarned;
  const completed: string[] = safeJson(String(prog.completed_j ?? "[]"), []);
  if (lessonId && !completed.includes(lessonId)) completed.push(lessonId);

  await exec(
    `UPDATE progress SET xp_total = xp_total + ?, xp_weekly = ?, xp_daily_j = ?, week_id = ?,
       streak_days = ?, last_prac = ?, completed_j = ?, updated_at = ? WHERE user_id = ?`,
    [xpEarned, xpW + xpEarned, JSON.stringify(xpDaily), weekId, streak, today, JSON.stringify(completed), nowIso(), uid]
  );
}

async function mutExerciseWrong(uid: string, p: Record<string, unknown>): Promise<void> {
  const prog     = await ensureProgress(uid);
  const mistakes: unknown[] = safeJson(String(prog.mistakes_j ?? "[]"), []);
  mistakes.push({ lessonId: String(p.lessonId ?? ""), exerciseId: String(p.exerciseId ?? ""), userAnswer: String(p.answer ?? ""), timestamp: nowIso() });
  if (mistakes.length > 200) mistakes.splice(0, mistakes.length - 200);
  await exec("UPDATE progress SET hearts = MAX(0, hearts - 1), mistakes_j = ?, updated_at = ? WHERE user_id = ?",
    [JSON.stringify(mistakes), nowIso(), uid]);
}

async function mutWordUpdate(uid: string, p: Record<string, unknown>): Promise<void> {
  const wordId = String(p.wordId ?? ""); if (!wordId) return;
  const fav    = "favorite" in p ? (p.favorite ? 1 : 0) : null;
  await exec(
    `INSERT INTO user_words (user_id, word_id, favorite, last_seen) VALUES (?, ?, COALESCE(?, 0), ?)
     ON CONFLICT(user_id, word_id) DO UPDATE SET favorite = COALESCE(excluded.favorite, favorite), last_seen = excluded.last_seen`,
    [uid, wordId, fav, nowIso()]
  );
  if ("status" in p) await exec("UPDATE user_words SET status = ? WHERE user_id = ? AND word_id = ?", [String(p.status), uid, wordId]);
}

async function mutPracticeComplete(uid: string, p: Record<string, unknown>): Promise<void> {
  const results = Array.isArray(p.results) ? p.results as Record<string, unknown>[] : [];
  const prog    = await ensureProgress(uid);
  const today   = todayKey(); const weekId = currentWeekId();
  const xpW     = String(prog.week_id) === weekId ? Number(prog.xp_weekly) : 0;
  const lastP   = String(prog.last_prac ?? "");
  let streak    = Number(prog.streak_days);

  if (lastP !== today) {
    if (!lastP) streak = 1;
    else { const yest = new Date(Date.now() - 86400_000).toISOString().slice(0, 10); streak = lastP === yest ? streak + 1 : 1; }
  }

  const xpDaily: Record<string, number> = safeJson(String(prog.xp_daily_j ?? "{}"), {});
  xpDaily[today] = (xpDaily[today] ?? 0) + XP_PER_PRACTICE;

  await exec(
    `UPDATE progress SET xp_total = xp_total + ?, xp_weekly = ?, xp_daily_j = ?, week_id = ?,
       streak_days = ?, last_prac = ?, updated_at = ? WHERE user_id = ?`,
    [XP_PER_PRACTICE, xpW + XP_PER_PRACTICE, JSON.stringify(xpDaily), weekId, streak, today, nowIso(), uid]
  );

  for (const r of results) {
    if (!r.wordId) continue;
    const correct = r.correct ? 1 : 0;
    await exec(
      `INSERT INTO user_words (user_id, word_id, corrects, mistakes, last_seen) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, word_id) DO UPDATE SET
         corrects = corrects + excluded.corrects, mistakes = mistakes + excluded.mistakes,
         last_seen = excluded.last_seen,
         status = CASE WHEN (corrects + excluded.corrects) >= 5 THEN 'mastered'
                       WHEN (corrects + excluded.corrects) >= 2 THEN 'practicing' ELSE status END`,
      [uid, String(r.wordId), correct, 1 - correct, nowIso()]
    );
  }
}

async function mutLessonUpsert(uid: string, p: Record<string, unknown>): Promise<void> {
  const lesson = (typeof p.lesson === "object" && p.lesson) ? p.lesson as Record<string, unknown> : p;
  if (!lesson.id) return;
  await exec(
    `INSERT INTO lessons (id, data_json, published, created_by, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, published = excluded.published, updated_at = excluded.updated_at`,
    [String(lesson.id), JSON.stringify(lesson), lesson.isPublished ? 1 : 0, uid, nowIso()]
  );
}

async function mutAdminUserUpdate(p: Record<string, unknown>): Promise<void> {
  const targetId = String(p.userId ?? ""); if (!targetId) return;
  const sets: string[] = []; const vals: Arg[] = [];
  if ("role" in p)               { sets.push("role = ?");       vals.push(String(p.role)); }
  if ("isBlocked" in p)          { sets.push("is_blocked = ?"); vals.push(p.isBlocked ? 1 : 0); }
  if ("subscriptionStatus" in p) { sets.push("sub_status = ?"); vals.push(String(p.subscriptionStatus)); }
  if ("level" in p)              { sets.push("level = ?");      vals.push(String(p.level)); }
  if (!sets.length) return;
  sets.push("updated_at = ?"); vals.push(nowIso()); vals.push(targetId);
  await exec(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, vals);
}

// ─── User endpoints ───────────────────────────────────────────────────────────

async function handleUserEmail(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  const email = String(body.email ?? "").toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, "Некоректний email", 422);
  if (await queryOne("SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1", [email, uid]))
    return fail(res, "Email вже використовується", 409);
  await exec("UPDATE users SET email = ?, updated_at = ? WHERE id = ?", [email, nowIso(), uid]);
  respond(res, { ok: true });
}

async function handleUserPassword(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  const cur  = String(body.currentPassword ?? body.current ?? "");
  const next = String(body.newPassword ?? body.password ?? "");
  if (next.length < 6) return fail(res, "Пароль занадто короткий", 422);
  const row  = await queryOne("SELECT pw_hash FROM users WHERE id = ? LIMIT 1", [uid]);
  if (!row) return fail(res, "Користувача не знайдено", 404);
  const h = String(row.pw_hash);
  if (h !== "DEV:skip" && !(await bcrypt.compare(cur, h))) return fail(res, "Невірний поточний пароль", 422);
  await exec("UPDATE users SET pw_hash = ?, updated_at = ? WHERE id = ?", [await bcrypt.hash(next, 11), nowIso(), uid]);
  respond(res, { ok: true });
}

async function handleFcmToken(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  const token = String(body.token ?? "").trim();
  if (!token) return fail(res, "Token required", 422);
  await exec(
    "INSERT INTO fcm_tokens (token, user_id, platform, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, created_at = excluded.created_at",
    [token, uid, String(body.platform ?? "web"), nowIso()]
  );
  respond(res, { ok: true });
}

async function handleUserReminder(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  const time = body.time !== undefined ? String(body.time ?? "").trim() : null;
  if (time && !/^\d{2}:\d{2}$/.test(time)) return fail(res, "Невірний формат часу (HH:MM)", 422);
  const row = await queryOne("SELECT settings_j FROM users WHERE id = ? LIMIT 1", [uid]);
  if (!row) return fail(res, "Користувача не знайдено", 404);
  const settings: Record<string, unknown> = safeJson(String(row.settings_j ?? "{}"), {});
  if (!time) delete settings.reminderTime; else settings.reminderTime = time;
  await exec("UPDATE users SET settings_j = ?, updated_at = ? WHERE id = ?", [JSON.stringify(settings), nowIso(), uid]);
  respond(res, { ok: true });
}

async function handleUserReferral(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  const referrerId = String(body.referrerId ?? "").trim();
  if (!referrerId || referrerId === uid) return respond(res, { ok: true });
  const cur = await queryOne("SELECT referred_by FROM users WHERE id = ? LIMIT 1", [uid]);
  if (!cur || String(cur.referred_by ?? "") !== "") return respond(res, { ok: true });
  if (!(await queryOne("SELECT id FROM users WHERE id = ? AND is_blocked = 0 LIMIT 1", [referrerId])))
    return respond(res, { ok: true });
  await exec("UPDATE users SET referred_by = ?, updated_at = ? WHERE id = ?", [referrerId, nowIso(), uid]);
  await exec("UPDATE progress SET freeze_cnt = freeze_cnt + 1, updated_at = ? WHERE user_id = ?", [nowIso(), referrerId]);
  respond(res, { ok: true });
}

// ─── Admin ────────────────────────────────────────────────────────────────────

async function handleAdminStats(req: VercelRequest, res: VercelResponse): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  if (!(await checkRole(uid, "admin"))) return fail(res, "Недостатньо прав", 403);

  const now  = Date.now();
  const day  = new Date(now - 86400_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const week = new Date(now - 7 * 86400_000).toISOString().replace(/\.\d{3}Z$/, "Z");

  const [total, a24, a7, plus, avgXpRow, avgStreakRow] = await Promise.all([
    queryOne("SELECT COUNT(*) as c FROM users"),
    queryOne("SELECT COUNT(*) as c FROM users WHERE updated_at > ?", [day]),
    queryOne("SELECT COUNT(*) as c FROM users WHERE updated_at > ?", [week]),
    queryOne("SELECT COUNT(*) as c FROM users WHERE sub_status = 'plus'"),
    queryOne("SELECT AVG(xp_total) as v FROM progress"),
    queryOne("SELECT AVG(streak_days) as v FROM progress"),
  ]);

  const levels: Record<string, number> = {};
  for (const r of await query("SELECT level, COUNT(*) as c FROM users GROUP BY level"))
    levels[String(r.level)] = Number(r.c);

  const dailyRegistrations: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d   = new Date(now - i * 86400_000).toISOString().slice(0, 10);
    const row = await queryOne("SELECT COUNT(*) as c FROM users WHERE created_at LIKE ?", [`${d}%`]);
    dailyRegistrations.push({ date: d, count: Number(row?.c ?? 0) });
  }

  const mistakeMap: Record<string, { total: number; exercises: Record<string, number> }> = {};
  for (const r of await query("SELECT mistakes_j FROM progress")) {
    for (const m of safeJson<{ lessonId?: string; exerciseId?: string }[]>(String(r.mistakes_j ?? "[]"), [])) {
      const lid = m.lessonId ?? "unknown"; const eid = m.exerciseId ?? "unknown";
      if (!mistakeMap[lid]) mistakeMap[lid] = { total: 0, exercises: {} };
      mistakeMap[lid].total++;
      mistakeMap[lid].exercises[eid] = (mistakeMap[lid].exercises[eid] ?? 0) + 1;
    }
  }
  const mistakeHeatmap = Object.fromEntries(Object.entries(mistakeMap).sort((a, b) => b[1].total - a[1].total).slice(0, 10));

  const retention: Record<string, { total: number; d1: number; d7: number; d30: number }> = {};
  for (const r of await query("SELECT strftime('%Y-%m', created_at) as month, created_at, updated_at FROM users")) {
    const m = String(r.month); if (!retention[m]) retention[m] = { total: 0, d1: 0, d7: 0, d30: 0 };
    retention[m].total++;
    const diff = new Date(String(r.updated_at)).getTime() - new Date(String(r.created_at)).getTime();
    if (diff >= 86400_000) retention[m].d1++;
    if (diff >= 7 * 86400_000) retention[m].d7++;
    if (diff >= 30 * 86400_000) retention[m].d30++;
  }

  respond(res, {
    ok: true,
    summary: {
      totalUsers: Number(total?.c ?? 0), active24h: Number(a24?.c ?? 0),
      active7d:   Number(a7?.c ?? 0),   plusUsers: Number(plus?.c ?? 0),
      avgXP:    Math.round(Number(avgXpRow?.v ?? 0) * 10) / 10,
      avgStreak: Math.round(Number(avgStreakRow?.v ?? 0) * 10) / 10,
    },
    levels, dailyRegistrations, mistakeHeatmap, retention, updatedAt: nowIso(),
  });
}

async function handleAdminErrors(req: VercelRequest, res: VercelResponse): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  if (!(await checkRole(uid, "admin"))) return fail(res, "Недостатньо прав", 403);
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const rows  = await query("SELECT * FROM client_errors ORDER BY created_at DESC LIMIT ?", [limit]);
  const total = await queryOne("SELECT COUNT(*) as c FROM client_errors");
  respond(res, {
    ok: true,
    errors: rows.map(r => ({ id: r.id, userId: r.user_id ?? null, message: String(r.message),
      stack: r.stack ?? null, url: r.url ?? null, userAgent: r.user_agent ?? null,
      ip: r.ip ?? null, createdAt: String(r.created_at) })),
    total: Number(total?.c ?? 0),
  });
}

async function handleAdminNotify(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  if (!(await checkRole(uid, "admin"))) return fail(res, "Недостатньо прав", 403);
  const title  = String(body.title ?? "").trim();
  const msg    = String(body.body ?? "").trim();
  const target = String(body.target ?? "all");
  if (!title || !msg) return fail(res, "title і body обов'язкові", 422);

  let sql = "SELECT ft.token FROM users u JOIN fcm_tokens ft ON ft.user_id = u.id WHERE u.is_blocked = 0";
  const args: Arg[] = [];
  if (target === "students")          { sql += " AND u.role = 'student'"; }
  else if (target === "plus")         { sql += " AND u.sub_status = 'plus'"; }
  else if (target.startsWith("level:")) { sql += " AND u.level = ?"; args.push(target.slice(6)); }

  const rows = await query(sql, args);
  if (!rows.length) return respond(res, { ok: true, sent: 0 });

  const serverKey = process.env.FIREBASE_SERVER_KEY;
  if (!serverKey) {
    console.error("[admin-notify] FIREBASE_SERVER_KEY not set — push not sent");
    return respond(res, { ok: true, sent: 0, warning: "Push not configured (FIREBASE_SERVER_KEY missing)" });
  }

  const tokens = rows.map(r => String(r.token));
  let sent = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    const r = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: { Authorization: `key=${serverKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        registration_ids: chunk,
        notification: { title, body: msg },
        data: { type: "admin_broadcast" },
      }),
    });
    if (r.ok) { const d = await r.json() as { success?: number }; sent += d.success ?? 0; }
    else console.error("[fcm] chunk failed:", r.status, await r.text().catch(() => ""));
  }
  respond(res, { ok: true, sent });
}

async function handlePostErrors(req: VercelRequest, res: VercelResponse, body: unknown): Promise<void> {
  const uid  = await getUid(req);
  const errs = Array.isArray(body) ? body : Array.isArray((body as Record<string, unknown>)?.errors) ? (body as Record<string, unknown[]>).errors : [body];
  for (const e of (errs as Record<string, unknown>[]).slice(0, 10)) {
    if (!e?.message) continue;
    await exec(
      "INSERT INTO client_errors (id, user_id, message, stack, url, user_agent, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [randomUUID(), uid ?? null, String(e.message).slice(0, 2000), e.stack ? String(e.stack).slice(0, 5000) : null,
       e.url ? String(e.url).slice(0, 500) : null, String(req.headers["user-agent"] ?? "").slice(0, 300), clientIp(req), nowIso()]
    );
  }
  respond(res, { ok: true });
}

// ─── Stripe ───────────────────────────────────────────────────────────────────
const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY ?? "", { apiVersion: "2025-05-28.basil" as Stripe.LatestApiVersion });

async function handleBillingCheckout(req: VercelRequest, res: VercelResponse): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  const priceId = process.env.STRIPE_PRICE_ID ?? "";
  if (!priceId) return fail(res, "STRIPE_PRICE_ID not configured", 503);
  const row = await queryOne("SELECT email, stripe_customer_id FROM users WHERE id = ? LIMIT 1", [uid]);
  if (!row) return fail(res, "User not found", 404);
  const appUrl = String(process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription", client_reference_id: uid,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/app/shop?subscribed=1`, cancel_url: `${appUrl}/app/shop`,
    allow_promotion_codes: true, metadata: { app_user_id: uid },
  };
  const cusId = String(row.stripe_customer_id ?? "");
  if (cusId) (params as Record<string, unknown>).customer = cusId;
  else params.customer_email = String(row.email);
  const session = await getStripe().checkout.sessions.create(params);
  respond(res, { url: session.url });
}

async function handleBillingPortal(req: VercelRequest, res: VercelResponse): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  const row = await queryOne("SELECT stripe_customer_id FROM users WHERE id = ? LIMIT 1", [uid]);
  const cusId = String(row?.stripe_customer_id ?? "");
  if (!cusId) return fail(res, "Billing account not found", 404);
  const appUrl  = String(process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
  const session = await getStripe().billingPortal.sessions.create({ customer: cusId, return_url: `${appUrl}/app/shop` });
  respond(res, { url: session.url });
}

async function handleBillingWebhook(req: VercelRequest, res: VercelResponse, rawBody: Buffer): Promise<void> {
  const secret     = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  const thinSecret = process.env.STRIPE_WEBHOOK_SECRET_THIN ?? "";
  if (!secret) return fail(res, "Webhook secret not configured", 503);
  const sig = (req.headers["stripe-signature"] as string) ?? "";
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch {
    // Try thin-payload destination secret (same URL, different signing key)
    if (thinSecret) {
      try { getStripe().webhooks.constructEvent(rawBody, sig, thinSecret); return respond(res, { ok: true }); }
      catch { /* fall through to 400 */ }
    }
    return fail(res, "Invalid signature", 400);
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    if (s.client_reference_id)
      await exec("UPDATE users SET sub_status = 'plus', stripe_customer_id = ?, stripe_sub_id = ?, updated_at = ? WHERE id = ?",
        [String(s.customer ?? ""), String(s.subscription ?? ""), nowIso(), s.client_reference_id]);
  }
  if (event.type === "customer.subscription.deleted") {
    const s = event.data.object as Stripe.Subscription;
    await exec("UPDATE users SET sub_status = 'free', stripe_sub_id = '', updated_at = ? WHERE stripe_customer_id = ?",
      [nowIso(), String(s.customer)]);
  }
  respond(res, { ok: true });
}

// ─── Main router ──────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCors(req, res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const rawBody  = await readRaw(req);
  const isJson   = (req.headers["content-type"] ?? "").includes("application/json");
  const body: Record<string, unknown> = isJson && rawBody.length ? safeJson(rawBody.toString(), {}) : {};

  const slugParam = req.query.path;
  const slug  = Array.isArray(slugParam) ? slugParam : (slugParam ? [String(slugParam)] : []);
  const route = "/" + slug.join("/");
  const meth  = req.method ?? "GET";

  try {
    if (meth === "GET"  && route === "/")                  return await handlePing(res);
    if (meth === "POST" && route === "/auth/register")     return await handleRegister(req, res, body);
    if (meth === "POST" && route === "/auth/login")        return await handleLogin(req, res, body);
    if (meth === "POST" && route === "/auth/logout")       return await handleLogout(res);
    if (meth === "POST" && route === "/auth/forgot")       return await handleForgot(res, body);
    if (meth === "POST" && route === "/auth/reset")        return await handleReset(res, body);
    if (meth === "POST" && route === "/auth/delete")       return await handleDeleteAccount(req, res, body);
    if (meth === "POST" && route === "/auth/deactivate")   return await handleDeactivate(req, res);
    if (meth === "GET"  && route === "/sync/pull")         return await handleSyncPull(req, res);
    if (meth === "POST" && route === "/sync/push")         return await handleSyncPush(req, res, body);
    if (meth === "POST" && route === "/user/email")        return await handleUserEmail(req, res, body);
    if (meth === "POST" && route === "/user/password")     return await handleUserPassword(req, res, body);
    if (meth === "POST" && route === "/user/fcm-token")    return await handleFcmToken(req, res, body);
    if (meth === "POST" && route === "/user/reminder")     return await handleUserReminder(req, res, body);
    if (meth === "POST" && route === "/user/referral")     return await handleUserReferral(req, res, body);
    if (meth === "GET"  && route === "/admin/stats")       return await handleAdminStats(req, res);
    if (meth === "GET"  && route === "/admin/errors")      return await handleAdminErrors(req, res);
    if (meth === "POST" && route === "/admin/notify")      return await handleAdminNotify(req, res, body);
    if (meth === "POST" && route === "/errors")            return await handlePostErrors(req, res, isJson ? body : safeJson(rawBody.toString(), {}));
    if (meth === "POST" && route === "/billing/checkout")  return await handleBillingCheckout(req, res);
    if (meth === "POST" && route === "/billing/portal")    return await handleBillingPortal(req, res);
    if (meth === "POST" && route === "/billing/webhook")   return await handleBillingWebhook(req, res, rawBody);
    res.status(404).json({ ok: false, error: "Not found" });
  } catch (err) {
    console.error("[API Error]", route, err);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
}
