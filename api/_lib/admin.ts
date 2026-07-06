import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Arg } from "./core";
import {
  exec, query, queryOne, nowIso, safeJson,
  requireUid, respond, fail, rowToUser, ensureProgress, checkRole
} from "./core";

export async function handleAdminStats(req: VercelRequest, res: VercelResponse): Promise<void> {
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

export async function handleAdminErrors(req: VercelRequest, res: VercelResponse): Promise<void> {
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

export async function handleAdminNotify(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
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

export async function handleAdminUsers(req: VercelRequest, res: VercelResponse): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  if (!(await checkRole(uid, "admin"))) return fail(res, "Недостатньо прав", 403);

  const search = String(req.query.search ?? "").trim();
  const role   = String(req.query.role ?? "");
  const sub    = String(req.query.sub ?? "");
  const limit  = Math.min(Number(req.query.limit ?? 100), 500);
  const offset = Number(req.query.offset ?? 0);

  const clauses: string[] = [];
  const args: Arg[] = [];
  if (search) { clauses.push("(u.name_text LIKE ? OR u.email LIKE ?)"); args.push(`%${search}%`, `%${search}%`); }
  if (role && role !== "all") { clauses.push("u.role = ?"); args.push(role); }
  if (sub  && sub  !== "all") { clauses.push("u.sub_status = ?"); args.push(sub); }
  const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";

  const [rows, totalRow] = await Promise.all([
    query(
      `SELECT u.id, u.email, u.name_text, u.role, u.level, u.avatar,
              u.sub_status, u.is_blocked, u.created_at, u.updated_at,
              COALESCE(p.xp_total, 0)    AS xp_total,
              COALESCE(p.streak_days, 0) AS streak_days,
              COALESCE(p.completed_j, '[]') AS completed_j
       FROM users u LEFT JOIN progress p ON p.user_id = u.id
       ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [...args, limit, offset]
    ),
    queryOne(`SELECT COUNT(*) AS c FROM users u ${where}`, args),
  ]);

  respond(res, {
    ok: true,
    total: Number(totalRow?.c ?? 0),
    users: rows.map(r => ({
      id:                 String(r.id),
      email:              String(r.email),
      name:               String(r.name_text),
      role:               String(r.role),
      level:              String(r.level),
      avatar:             r.avatar ? String(r.avatar) : null,
      subscriptionStatus: String(r.sub_status),
      isBlocked:          Boolean(r.is_blocked),
      createdAt:          String(r.created_at),
      updatedAt:          String(r.updated_at),
      xpTotal:            Number(r.xp_total),
      streakDays:         Number(r.streak_days),
      completedCount:     safeJson<string[]>(String(r.completed_j), []).length,
    })),
  });
}

export async function handleAdminUserDetail(req: VercelRequest, res: VercelResponse, targetId: string): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  if (!(await checkRole(uid, "admin"))) return fail(res, "Недостатньо прав", 403);

  const row = await queryOne("SELECT * FROM users WHERE id = ? LIMIT 1", [targetId]);
  if (!row) return fail(res, "Користувача не знайдено", 404);
  const prog = await ensureProgress(targetId);

  respond(res, {
    ok: true,
    user: rowToUser(row),
    progress: {
      xpTotal:           Number(prog.xp_total),
      xpWeekly:          Number(prog.xp_weekly),
      xpDailyHistory:    safeJson<Record<string, number>>(String(prog.xp_daily_j ?? "{}"), {}),
      streakDays:        Number(prog.streak_days),
      completedLessons:  safeJson<string[]>(String(prog.completed_j ?? "[]"), []),
      mistakes:          safeJson<unknown[]>(String(prog.mistakes_j ?? "[]"), []),
      hearts:            Number(prog.hearts),
      maxHearts:         Number(prog.max_hearts),
      lastPracticeDate:  prog.last_prac || null,
      streakFreezeCount: Number(prog.freeze_cnt),
    },
  });
}

export async function handleAdminUserPatch(req: VercelRequest, res: VercelResponse, targetId: string, body: Record<string, unknown>): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  if (!(await checkRole(uid, "admin"))) return fail(res, "Недостатньо прав", 403);

  const sets: string[] = []; const vals: Arg[] = [];
  if ("role" in body)               { sets.push("role = ?");       vals.push(String(body.role)); }
  if ("isBlocked" in body)          { sets.push("is_blocked = ?"); vals.push(body.isBlocked ? 1 : 0); }
  if ("subscriptionStatus" in body) { sets.push("sub_status = ?"); vals.push(String(body.subscriptionStatus)); }
  if ("level" in body)              { sets.push("level = ?");      vals.push(String(body.level)); }
  if (!sets.length) return respond(res, { ok: true });

  sets.push("updated_at = ?"); vals.push(nowIso(), targetId);
  await exec(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, vals);
  const updated = await queryOne("SELECT * FROM users WHERE id = ? LIMIT 1", [targetId]);
  respond(res, { ok: true, user: updated ? rowToUser(updated) : null });
}

export async function handleAdminImportLessons(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  if (!(await checkRole(uid, "admin"))) return fail(res, "Недостатньо прав", 403);

  const mode    = String(body.mode ?? "skip") as "skip" | "overwrite";
  const rawArr  = body.lessons;
  if (!Array.isArray(rawArr)) return fail(res, "lessons має бути масивом", 422);

  type ParsedLesson = Record<string, unknown>;
  const validated: ParsedLesson[] = [];
  const parseErrors: Array<{ id: string; error: string }> = [];

  for (let i = 0; i < rawArr.length; i++) {
    const raw = rawArr[i] as Record<string, unknown>;
    const id = raw?.id ? String(raw.id) : `#${i + 1}`;
    try {
      if (!raw.id)    throw new Error("відсутній id");
      if (!raw.title) throw new Error("відсутній title");
      if (!raw.level) throw new Error("відсутній level");
      validated.push(raw);
    } catch (err) {
      parseErrors.push({ id, error: (err as Error).message });
    }
  }

  if (parseErrors.length > 0) {
    return fail(res, `Помилки валідації: ${parseErrors.map((e) => `${e.id}: ${e.error}`).join("; ")}`, 422);
  }

  const ids = validated.map((l) => String(l.id));
  const existing = new Set<string>();
  for (const id of ids) {
    const row = await queryOne("SELECT id FROM lessons WHERE id = ? LIMIT 1", [id]);
    if (row) existing.add(id);
  }

  let imported = 0;
  let skipped  = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (let i = 0; i < validated.length; i += 10) {
    const batch = validated.slice(i, i + 10);
    for (const lesson of batch) {
      const lid = String(lesson.id);
      try {
        if (existing.has(lid) && mode === "skip") {
          skipped++;
          continue;
        }
        await exec(
          `INSERT INTO lessons (id, data_json, published, created_by, updated_at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, published = excluded.published, updated_at = excluded.updated_at`,
          [lid, JSON.stringify(lesson), lesson.isPublished ? 1 : 0, uid, nowIso()]
        );
        imported++;
      } catch (err) {
        errors.push({ id: lid, error: (err as Error).message });
      }
    }
  }

  respond(res, { ok: true, imported, skipped, errors });
}
