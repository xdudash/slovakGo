import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import {
  LOGIN_WINDOW_SEC, LOGIN_MAX_ATTEMPTS, defaultSettingsJson,
  exec, queryOne, nowIso, clientIp, signToken, setCookie,
  respond, fail, rowToUser, ensureProgress, clearCookie,
  requireUid, parseCookies
} from "./core";

export async function handleRegister(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const ip  = clientIp(req);
  const win = new Date(Date.now() - LOGIN_WINDOW_SEC * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
  await exec("DELETE FROM login_attempts WHERE attempted_at < ?", [win]);

  const attempts = Number((await queryOne("SELECT COUNT(*) as c FROM login_attempts WHERE ip = ? AND attempted_at > ?", [ip, win]))?.c ?? 0);
  if (attempts >= LOGIN_MAX_ATTEMPTS) {
    res.setHeader("Retry-After", String(LOGIN_WINDOW_SEC));
    return fail(res, "Занадто багато спроб. Спробуй через 15 хвилин.", 429);
  }

  const email    = String(body.email ?? "").toLowerCase().trim().slice(0, 150);
  const password = String(body.password ?? "").slice(0, 150);
  const name     = String(body.name ?? "Студент").trim().slice(0, 100);
  const goal     = String(body.goal ?? "").trim().slice(0, 200);
  const cliId    = String(body.id ?? "").trim().slice(0, 50);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    await exec("INSERT INTO login_attempts (ip, attempted_at) VALUES (?, ?)", [ip, nowIso()]);
    return fail(res, "Некоректний email", 422);
  }
  if (password.length < 8 || !/[A-ZА-ЯІЇЄҐ]/.test(password) || !/[a-zа-яіїєґ]/.test(password) || !/\d/.test(password))
    return fail(res, "Пароль має містити мінімум 8 символів, велику та малу літеру і цифру", 422);

  if (await queryOne("SELECT id FROM users WHERE email = ? LIMIT 1", [email]))
    return fail(res, "Email вже зареєстрований", 409);

  const id    = cliId || `user-${randomUUID()}`;
  const now   = nowIso();
  const hash  = await bcrypt.hash(password, 11);
  const defS  = defaultSettingsJson();

  await exec(
    `INSERT INTO users (id, email, pw_hash, name_text, role, level, goal, sub_status, trial_ends, ob_done, settings_j, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'student', 'A0', ?, 'free', NULL, 0, ?, ?, ?)`,
    [id, email, hash, name, goal || null, defS, now, now]
  );
  await ensureProgress(id);

  const row = await queryOne("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
  if (!row) return fail(res, "Помилка реєстрації", 500);

  setCookie(res, await signToken(id));
  respond(res, { ok: true, user: rowToUser(row) }, 201);
}

export async function handleLogin(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
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

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminEmail && adminPassword && email === adminEmail && password === adminPassword) {
    let adminRow = await queryOne("SELECT * FROM users WHERE email = ? LIMIT 1", [adminEmail]);
    const now = nowIso();
    if (!adminRow) {
      const id = `user-admin-${randomUUID()}`;
      const trial = new Date(Date.now() + 100 * 365 * 86400_000).toISOString().replace(/\.\d{3}Z$/, "Z");
      const defS = defaultSettingsJson();
      const hash = await bcrypt.hash(adminPassword, 11);
      
      await exec(
        `INSERT INTO users (id, email, pw_hash, name_text, role, level, goal, sub_status, trial_ends, ob_done, settings_j, google_sub, created_at, updated_at)
         VALUES (?, ?, ?, 'Admin', 'admin', 'A0', NULL, 'active', ?, 1, ?, NULL, ?, ?)`,
        [id, adminEmail, hash, trial, defS, now, now]
      );
      await ensureProgress(id);
      adminRow = await queryOne("SELECT * FROM users WHERE email = ? LIMIT 1", [adminEmail]);
    } else if (adminRow.role !== "admin") {
      await exec("UPDATE users SET role = 'admin', updated_at = ? WHERE email = ?", [now, adminEmail]);
      adminRow = await queryOne("SELECT * FROM users WHERE email = ? LIMIT 1", [adminEmail]);
    }

    await exec("DELETE FROM login_attempts WHERE ip = ?", [ip]);
    setCookie(res, await signToken(String(adminRow!.id)));
    respond(res, { ok: true, user: rowToUser(adminRow!) });
    return;
  }

  const row      = await queryOne("SELECT * FROM users WHERE email = ? AND is_blocked = 0 LIMIT 1", [email]);
  const hash     = String(row?.pw_hash ?? "");
  if (row && hash === "") return fail(res, "Цей акаунт використовує вхід через Google", 401);
  const valid    = row && (hash === "DEV:skip" || await bcrypt.compare(password, hash));

  if (!valid) {
    await exec("INSERT INTO login_attempts (ip, attempted_at) VALUES (?, ?)", [ip, nowIso()]);
    return fail(res, "Невірний email або пароль", 401);
  }

  await exec("DELETE FROM login_attempts WHERE ip = ?", [ip]);
  setCookie(res, await signToken(String(row!.id)));
  respond(res, { ok: true, user: rowToUser(row!) });
}

export async function handleLogout(res: VercelResponse): Promise<void> {
  clearCookie(res);
  respond(res, { ok: true });
}

export async function handleForgot(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const ip  = clientIp(req);
  const win = new Date(Date.now() - LOGIN_WINDOW_SEC * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
  await exec("DELETE FROM login_attempts WHERE attempted_at < ?", [win]);

  const attempts = Number((await queryOne("SELECT COUNT(*) as c FROM login_attempts WHERE ip = ? AND attempted_at > ?", [ip, win]))?.c ?? 0);
  if (attempts >= LOGIN_MAX_ATTEMPTS) {
    res.setHeader("Retry-After", String(LOGIN_WINDOW_SEC));
    return fail(res, "Занадто багато спроб. Спробуй через 15 хвилин.", 429);
  }
  await exec("INSERT INTO login_attempts (ip, attempted_at) VALUES (?, ?)", [ip, nowIso()]);

  const email = String(body.email ?? "").toLowerCase().trim().slice(0, 150);
  const row   = await queryOne("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
  if (!row) return respond(res, { ok: true });

  const uid     = String(row.id);
  const fiveMin = new Date(Date.now() - 5 * 60_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const recent  = await queryOne("SELECT 1 FROM password_resets WHERE user_id = ? AND used = 0 AND created_at > ? LIMIT 1", [uid, fiveMin]);
  if (recent) return respond(res, { ok: true });

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

export async function handleReset(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const ip  = clientIp(req);
  const win = new Date(Date.now() - LOGIN_WINDOW_SEC * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
  await exec("DELETE FROM login_attempts WHERE attempted_at < ?", [win]);

  const attempts = Number((await queryOne("SELECT COUNT(*) as c FROM login_attempts WHERE ip = ? AND attempted_at > ?", [ip, win]))?.c ?? 0);
  if (attempts >= LOGIN_MAX_ATTEMPTS) {
    res.setHeader("Retry-After", String(LOGIN_WINDOW_SEC));
    return fail(res, "Занадто багато спроб. Спробуй через 15 хвилин.", 429);
  }

  const token    = String(body.token ?? "").slice(0, 200);
  const password = String(body.password ?? "").slice(0, 150);
  if (!token || password.length < 8 || !/[A-ZА-ЯІЇЄҐ]/.test(password) || !/[a-zа-яіїєґ]/.test(password) || !/\d/.test(password)) {
    await exec("INSERT INTO login_attempts (ip, attempted_at) VALUES (?, ?)", [ip, nowIso()]);
    return fail(res, "Пароль має містити мінімум 8 символів, велику та малу літеру і цифру", 422);
  }

  const hash = createHash("sha256").update(token).digest("hex");
  const row  = await queryOne("SELECT * FROM password_resets WHERE token_hash = ? AND used = 0 LIMIT 1", [hash]);
  if (!row) return fail(res, "Токен недійсний або вже використаний", 422);
  if (Date.now() - new Date(String(row.created_at)).getTime() > 30 * 60_000)
    return fail(res, "Токен застарів", 422);

  await exec("UPDATE users SET pw_hash = ?, updated_at = ? WHERE id = ?", [await bcrypt.hash(password, 11), nowIso(), String(row.user_id)]);
  await exec("UPDATE password_resets SET used = 1 WHERE token_hash = ?", [hash]);
  respond(res, { ok: true });
}

export async function handleDeleteAccount(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const uid = await requireUid(req, res);
  if (!uid) return;
  const email = String(body.email ?? body.confirmEmail ?? "").toLowerCase().trim();
  const row   = await queryOne("SELECT email FROM users WHERE id = ? LIMIT 1", [uid]);
  if (!row || String(row.email) !== email) return fail(res, "Email не співпадає", 422);

  await exec("DELETE FROM user_words WHERE user_id = ?", [uid]);
  await exec("DELETE FROM progress WHERE user_id = ?", [uid]);
  await exec("DELETE FROM fcm_tokens WHERE user_id = ?", [uid]);
  await exec("DELETE FROM sync_log WHERE user_id = ?", [uid]);
  await exec("DELETE FROM users WHERE id = ?", [uid]);

  clearCookie(res);
  respond(res, { ok: true });
}

export async function handleDeactivate(req: VercelRequest, res: VercelResponse): Promise<void> {
  const uid = await requireUid(req, res);
  if (!uid) return;
  await exec("UPDATE users SET is_blocked = 1, updated_at = ? WHERE id = ?", [nowIso(), uid]);
  clearCookie(res);
  respond(res, { ok: true });
}

const OAUTH_STATE_COOKIE = "sl_oauth_state";

export async function handleGoogleStart(_req: VercelRequest, res: VercelResponse): Promise<void> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) { fail(res, "Google OAuth не налаштовано", 503); return; }
  const appUrl = String(process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
  const state = randomBytes(32).toString("hex");
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${OAUTH_STATE_COOKIE}=${state}; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=600${secure}`);
  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  `${appUrl}/api/auth/google/callback`,
    response_type: "code",
    scope:         "email profile",
    access_type:   "online",
    prompt:        "select_account",
    state,
  });
  res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  res.end();
}

export async function handleGoogleCallback(req: VercelRequest, res: VercelResponse): Promise<void> {
  const appUrl   = String(process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
  const code     = String(req.query.code ?? "");
  const errParam = String(req.query.error ?? "");
  const state = String(req.query.state ?? "");
  const expectedState = parseCookies(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE] ?? "";
  const stateValid = state.length === expectedState.length && state.length > 0 &&
    timingSafeEqual(Buffer.from(state), Buffer.from(expectedState));
  res.setHeader("Set-Cookie", `${OAUTH_STATE_COOKIE}=; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=0`);

  if (!code || errParam || !stateValid) {
    res.writeHead(302, { Location: `${appUrl}/login?error=google_cancelled` });
    res.end(); return;
  }

  try {
    const clientId     = process.env.GOOGLE_CLIENT_ID ?? "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
    const redirectUri  = `${appUrl}/api/auth/google/callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    if (!tokenRes.ok) throw new Error(`token_exchange_failed:${tokenRes.status}`);
    const tokens = await tokenRes.json() as { access_token: string };

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) throw new Error("profile_fetch_failed");
    const gUser = await profileRes.json() as { id: string; email: string; name: string; picture?: string };

    const email = gUser.email.toLowerCase();

    try { await exec("ALTER TABLE users ADD COLUMN google_sub TEXT"); } catch { /* already exists */ }

    const row = await queryOne("SELECT * FROM users WHERE email = ? OR google_sub = ? LIMIT 1", [email, gUser.id]);

    if (row) {
      if (!row.google_sub) {
        await exec("UPDATE users SET google_sub = ?, updated_at = ? WHERE id = ?", [gUser.id, nowIso(), String(row.id)]);
      }
      setCookie(res, await signToken(String(row.id)));
      res.writeHead(302, { Location: `${appUrl}/auth/google/done` });
    } else {
      const id    = `user-${randomUUID()}`;
      const now   = nowIso();
      const defS  = defaultSettingsJson();
      const name  = gUser.name || email.split("@")[0];

      await exec(
        `INSERT INTO users (id, email, pw_hash, name_text, role, level, goal, sub_status, trial_ends, ob_done, settings_j, google_sub, created_at, updated_at)
         VALUES (?, ?, '', ?, 'student', 'A0', NULL, 'free', NULL, 0, ?, ?, ?, ?)`,
        [id, email, name, defS, gUser.id, now, now]
      );
      await ensureProgress(id);
      setCookie(res, await signToken(id));
      res.writeHead(302, { Location: `${appUrl}/auth/google/done?new=1` });
    }
    res.end();
  } catch (err) {
    console.error("[Google OAuth]", err);
    res.writeHead(302, { Location: `${appUrl}/login?error=google_failed` });
    res.end();
  }
}
