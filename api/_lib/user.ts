import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import {
  exec, query, queryOne, nowIso, safeJson, clientIp, currentWeekId,
  requireUid, getUid, respond, fail
} from "./core";

export async function handleUserEmail(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  const email = String(body.email ?? "").toLowerCase().trim();
  const password = String(body.currentPassword ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, "Некоректний email", 422);
  const current = await queryOne("SELECT pw_hash FROM users WHERE id = ? LIMIT 1", [uid]);
  const hash = String(current?.pw_hash ?? "");
  if (!hash || (hash !== "DEV:skip" && !(await bcrypt.compare(password, hash))))
    return fail(res, "Невірний поточний пароль", 422);
  if (await queryOne("SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1", [email, uid]))
    return fail(res, "Email вже використовується", 409);
  await exec("UPDATE users SET email = ?, updated_at = ? WHERE id = ?", [email, nowIso(), uid]);
  respond(res, { ok: true });
}

export async function handleUserPassword(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  const cur  = String(body.currentPassword ?? body.current ?? "");
  const next = String(body.newPassword ?? body.password ?? "");
  if (next.length < 8 || !/[A-ZА-ЯІЇЄҐ]/.test(next) || !/[a-zа-яіїєґ]/.test(next) || !/\d/.test(next))
    return fail(res, "Пароль має містити мінімум 8 символів, велику та малу літеру і цифру", 422);
  const row  = await queryOne("SELECT pw_hash FROM users WHERE id = ? LIMIT 1", [uid]);
  if (!row) return fail(res, "Користувача не знайдено", 404);
  const h = String(row.pw_hash);
  if (h !== "DEV:skip" && !(await bcrypt.compare(cur, h))) return fail(res, "Невірний поточний пароль", 422);
  await exec("UPDATE users SET pw_hash = ?, updated_at = ? WHERE id = ?", [await bcrypt.hash(next, 11), nowIso(), uid]);
  respond(res, { ok: true });
}

export async function handleFcmToken(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  const token = String(body.token ?? "").trim();
  if (!token) {
    await exec("DELETE FROM fcm_tokens WHERE user_id = ?", [uid]);
    return respond(res, { ok: true });
  }
  await exec(
    "INSERT INTO fcm_tokens (token, user_id, platform, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, created_at = excluded.created_at",
    [token, uid, String(body.platform ?? "web"), nowIso()]
  );
  respond(res, { ok: true });
}

export async function handleUserReminder(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
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

export async function handleUserReferral(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
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

export async function handleLeaderboard(req: VercelRequest, res: VercelResponse): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  const weekId = currentWeekId();

  const rows = await query(
    `SELECT u.id, u.name_text, u.avatar, u.country, p.xp_weekly, p.week_id
     FROM progress p JOIN users u ON u.id = p.user_id
     WHERE u.is_blocked = 0 AND u.role = 'student'
     ORDER BY p.xp_weekly DESC LIMIT 50`
  );

  const entries = rows.map((r, idx) => ({
    userId:   String(r.id),
    name:     String(r.name_text),
    avatar:   r.avatar ? String(r.avatar) : null,
    country:  r.country ? String(r.country) : null,
    xpWeekly: String(r.week_id) === weekId ? Number(r.xp_weekly) : 0,
    rank:     idx + 1,
  }));

  let myRank: number | null = entries.find(e => e.userId === uid)?.rank ?? null;
  if (myRank === null) {
    const myProg  = await queryOne("SELECT xp_weekly, week_id FROM progress WHERE user_id = ?", [uid]);
    const myXp    = myProg && String(myProg.week_id) === weekId ? Number(myProg.xp_weekly) : 0;
    const rankRow = await queryOne(
      `SELECT COUNT(*) + 1 AS rank FROM progress p JOIN users u ON u.id = p.user_id
       WHERE u.is_blocked = 0 AND u.role = 'student' AND p.xp_weekly > ?`,
      [myXp]
    );
    myRank = Number(rankRow?.rank ?? 0);
  }

  respond(res, { ok: true, entries, weekId, myRank });
}

export async function handlePostErrors(req: VercelRequest, res: VercelResponse, body: unknown): Promise<void> {
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

export async function handleSupportSend(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const uid   = await requireUid(req, res); if (!uid) return;
  const topic = String(body.topic   ?? "").slice(0, 100).trim();
  const msg   = String(body.message ?? "").slice(0, 5000).trim();
  if (!topic || !msg) return fail(res, "Вкажи тему та повідомлення", 422);

  const row = await queryOne("SELECT email, name_text FROM users WHERE id = ? LIMIT 1", [uid]);
  if (!row) return fail(res, "Користувача не знайдено", 404);

  const userEmail  = String(row.email);
  const userName   = String(row.name_text ?? "Користувач");
  const appVersion = String(body.appVersion ?? "—");
  const userAgent  = String(req.headers["user-agent"] ?? "—");
  const fromAddr   = process.env.MAIL_FROM ?? "noreply@slovakgo.sk";
  const supportTo  = process.env.SUPPORT_EMAIL ?? "support@slovakgo.sk";
  const resendKey  = process.env.RESEND_API_KEY ?? "";

  if (!resendKey) return fail(res, "Email не налаштовано", 503);

  const topicLabels: Record<string, string> = {
    bug: "Баг", question: "Питання", other: "Інше",
  };
  const topicLabel = topicLabels[topic] ?? topic;
  const subject    = `[SlovakGO Support] ${topicLabel} від ${userName}`;

  const inHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f7ff;margin:0;padding:32px 16px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,0.07);">
  <h2 style="margin:0 0 20px;font-size:18px;color:#1a1040;">${subject}</h2>
  <table style="border-collapse:collapse;font-size:14px;color:#374151;margin-bottom:24px;">
    <tr><td style="padding:4px 12px 4px 0;color:#9ca3af;white-space:nowrap;">Від</td><td>${userName} &lt;${userEmail}&gt;</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#9ca3af;white-space:nowrap;">User ID</td><td><code>${uid}</code></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#9ca3af;white-space:nowrap;">Тема</td><td>${topicLabel}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#9ca3af;white-space:nowrap;">Версія</td><td>${appVersion}</td></tr>
    <tr><td style="padding:4px 12px 4td 0;color:#9ca3af;white-space:nowrap;">User Agent</td><td style="word-break:break-all;font-size:12px;">${userAgent}</td></tr>
  </table>
  <div style="background:#f3f4f6;border-radius:8px;padding:16px;font-size:15px;line-height:1.6;white-space:pre-wrap;color:#1f2937;">${msg.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
  <p style="margin:20px 0 0;font-size:12px;color:#d1d5db;">Надіслано через форму підтримки SlovakGO</p>
</div></body></html>`;

  const replyHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f7ff;margin:0;padding:40px 20px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:40px 32px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <h1 style="font-size:22px;font-weight:800;color:#1a1040;margin:0 0 4px;">SlovakGO</h1>
  <p style="color:#9ca3af;margin:0 0 32px;font-size:13px;">Підтримка</p>
  <h2 style="font-size:18px;font-weight:700;color:#1a1040;margin:0 0 12px;">Ми отримали твоє звернення!</h2>
  <p style="color:#374151;line-height:1.6;margin:0 0 16px;">Привіт, ${userName}! Дякуємо за повідомлення — ми відповімо протягом 24 годин.</p>
  <div style="background:#f3f4f6;border-radius:8px;padding:14px 16px;font-size:14px;color:#6b7280;margin-bottom:24px;">
    <strong>Тема:</strong> ${topicLabel}<br>
    <strong>Повідомлення:</strong> ${msg.replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 200)}${msg.length > 200 ? "…" : ""}
  </div>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;">
  <p style="color:#d1d5db;font-size:11px;margin:0;">© 2026 SlovakGO · <a href="https://slovakgo.sk" style="color:#9ca3af;">slovakgo.sk</a></p>
</div></body></html>`;

  await Promise.all([
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromAddr, to: supportTo, reply_to: userEmail, subject, html: inHtml }),
    }).then(r => { if (!r.ok) r.text().then(t => console.error("[support] inbound send failed:", t)); }),
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromAddr, to: userEmail, subject: "Ми отримали твоє звернення — SlovakGO", html: replyHtml }),
    }).then(r => { if (!r.ok) r.text().then(t => console.error("[support] auto-reply failed:", t)); }),
  ]);

  respond(res, { ok: true });
}
