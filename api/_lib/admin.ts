import { closeIdleSessions, ensureActivity } from "./activity";
export { handleAdminUsers } from "./adminUsers";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Arg } from "./core";
import { normalizeLessonPayload } from "./lessonValidation";
import {
  exec, query, queryOne, nowIso, safeJson, ensureCol,
  requireUid, respond, fail, rowToUser, ensureProgress, getUserWords, checkRole
} from "./core";

export async function handleTeacherStats(req: VercelRequest, res: VercelResponse): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  if (!(await checkRole(uid, "teacher", "admin"))) return fail(res, "Недостатньо прав", 403);

  const [studentRow, progressRows, lessonRows] = await Promise.all([
    queryOne("SELECT COUNT(*) AS c FROM users WHERE role = 'student' AND is_blocked = 0"),
    query("SELECT completed_j, mistakes_j FROM progress p JOIN users u ON u.id = p.user_id WHERE u.role = 'student' AND u.is_blocked = 0"),
    query("SELECT id, data_json FROM lessons ORDER BY rowid"),
  ]);

  const completions = new Map<string, number>();
  let mistakes = 0;
  for (const row of progressRows) {
    const completed = safeJson<string[]>(String(row.completed_j ?? "[]"), []);
    for (const lessonId of completed) completions.set(lessonId, (completions.get(lessonId) ?? 0) + 1);
    mistakes += safeJson<unknown[]>(String(row.mistakes_j ?? "[]"), []).length;
  }

  const lessons = lessonRows.map((row) => {
    const lesson = safeJson<Record<string, unknown>>(String(row.data_json ?? "{}"), {});
    return {
      id: String(row.id),
      title: lesson.title ?? String(row.id),
      exercises: Array.isArray(lesson.exercises) ? lesson.exercises.length : 0,
      completions: completions.get(String(row.id)) ?? 0,
    };
  });

  respond(res, {
    ok: true,
    summary: {
      students: Number(studentRow?.c ?? 0),
      completions: Array.from(completions.values()).reduce((sum, value) => sum + value, 0),
      mistakes,
      lessons: lessonRows.length,
    },
    lessons,
  });
}

/**
 * Activation funnel for students who registered in the last 30 days, plus the
 * lessons where learners most often start but do not finish. Answers "where do
 * new users get stuck?" without exporting anything.
 */
export async function activationFunnel(now: number) {
  const since = new Date(now - 30 * 86400_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  await exec(
    `CREATE TABLE IF NOT EXISTS events (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       user_id TEXT, name TEXT NOT NULL,
       props_j TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL)`
  );
  const cohort = `SELECT id FROM users WHERE role = 'student' AND is_blocked = 0 AND created_at >= ? AND email NOT LIKE '%@example.com'`;
  const done = (min: number) => queryOne(
    `SELECT COUNT(*) as c FROM progress WHERE user_id IN (${cohort}) AND json_array_length(completed_j) >= ?`, [since, min]);
  const [registered, onboarded, started, done1, done3, done10, paying] = await Promise.all([
    queryOne(`SELECT COUNT(*) as c FROM (${cohort})`, [since]),
    queryOne(`SELECT COUNT(*) as c FROM users WHERE ob_done = 1 AND id IN (${cohort})`, [since]),
    queryOne(
      `SELECT COUNT(DISTINCT user_id) as c FROM (
         SELECT user_id FROM events WHERE name = 'lesson_start' AND user_id IN (${cohort})
         UNION SELECT user_id FROM progress WHERE json_array_length(completed_j) >= 1 AND user_id IN (${cohort}))`,
      [since, since]),
    done(1), done(3), done(10),
    queryOne(`SELECT COUNT(*) as c FROM users WHERE sub_status IN ('plus', 'trial', 'past_due') AND id IN (${cohort})`, [since]),
  ]);
  const n = (r: Record<string, unknown> | null | undefined) => Number(r?.c ?? 0);
  const steps = [
    { key: "registered", label: "Зареєструвались", count: n(registered) },
    { key: "onboarded", label: "Пройшли онбординг", count: n(onboarded) },
    { key: "started", label: "Почали урок", count: n(started) },
    { key: "done1", label: "Завершили 1+ урок", count: n(done1) },
    { key: "done3", label: "Завершили 3+ уроки", count: n(done3) },
    { key: "done10", label: "Пройшли 10 безкоштовних", count: n(done10) },
    { key: "paying", label: "Підписка / trial", count: n(paying) },
  ];

  const lessonRows = await query(
    `SELECT json_extract(props_j, '$.lessonId') as lesson_id,
            COUNT(DISTINCT CASE WHEN name = 'lesson_start' THEN user_id END) as started,
            COUNT(DISTINCT CASE WHEN name = 'lesson_complete' THEN user_id END) as completed
       FROM events
      WHERE name IN ('lesson_start', 'lesson_complete') AND created_at >= ? AND user_id IS NOT NULL
        AND user_id IN (SELECT id FROM users WHERE role = 'student')
      GROUP BY lesson_id`,
    [since]
  );
  const lessonDropoff = lessonRows
    .map((r) => ({ lessonId: String(r.lesson_id ?? ""), started: Number(r.started), completed: Number(r.completed) }))
    .filter((r) => r.lessonId && r.started >= 2 && r.started > r.completed)
    .sort((a, b) => (b.started - b.completed) - (a.started - a.completed) || b.started - a.started)
    .slice(0, 8);

  return { since, steps, lessonDropoff };
}

export async function handleAdminStats(req: VercelRequest, res: VercelResponse): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  if (!(await checkRole(uid, "admin"))) return fail(res, "Недостатньо прав", 403);

  await closeIdleSessions();
  const now  = Date.now();
  const day  = new Date(now - 86400_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const week = new Date(now - 7 * 86400_000).toISOString().replace(/\.\d{3}Z$/, "Z");

  const [total, a24, a7, plus, avgXpRow, avgStreakRow] = await Promise.all([
    queryOne("SELECT COUNT(*) as c FROM users"),
    queryOne("SELECT COUNT(DISTINCT user_id) as c FROM activity_sessions WHERE last_active_at > ?", [day]),
    queryOne("SELECT COUNT(DISTINCT user_id) as c FROM activity_sessions WHERE last_active_at > ?", [week]),
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
  // "Last seen" comes from real learning activity. users.updated_at is not touched
  // by lessons or sessions, so using it reported 0% retention for every cohort
  // whose learners never edited their profile.
  await ensureActivity();
  await exec(
    `CREATE TABLE IF NOT EXISTS events (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       user_id TEXT, name TEXT NOT NULL,
       props_j TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL)`
  );
  const retentionRows = await query(
    `SELECT strftime('%Y-%m', u.created_at) AS month, u.created_at,
            MAX(
              COALESCE((SELECT MAX(last_active_at) FROM activity_sessions a WHERE a.user_id = u.id), ''),
              COALESCE((SELECT MAX(created_at) FROM events e WHERE e.user_id = u.id), ''),
              COALESCE(p.last_prac, ''),
              CASE WHEN json_array_length(COALESCE(p.completed_j, '[]')) > 0 THEN COALESCE(p.updated_at, '') ELSE '' END
            ) AS last_seen
       FROM users u LEFT JOIN progress p ON p.user_id = u.id
      WHERE u.role = 'student'`
  );
  for (const r of retentionRows) {
    const m = String(r.month); if (!retention[m]) retention[m] = { total: 0, d1: 0, d7: 0, d30: 0 };
    retention[m].total++;
    const lastSeen = String(r.last_seen ?? "");
    const diff = lastSeen ? new Date(lastSeen).getTime() - new Date(String(r.created_at)).getTime() : 0;
    if (diff >= 86400_000) retention[m].d1++;
    if (diff >= 7 * 86400_000) retention[m].d7++;
    if (diff >= 30 * 86400_000) retention[m].d30++;
  }

  const funnel = await activationFunnel(now);

  respond(res, {
    ok: true,
    funnel,
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
  if (!rows.length) return respond(res, { ok: true, sent: 0, warning: "No FCM tokens found" });

  // FCM V1 API with Service Account
  const saJson = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "").trim();
  if (!saJson) {
    console.error("[admin-notify] FIREBASE_SERVICE_ACCOUNT_JSON not set");
    return respond(res, { ok: true, sent: 0, warning: "Push not configured (FIREBASE_SERVICE_ACCOUNT_JSON missing)" });
  }

  let sa: { project_id: string; client_email: string; private_key: string };
  try { sa = JSON.parse(saJson); } catch {
    return respond(res, { ok: true, sent: 0, warning: "Invalid FIREBASE_SERVICE_ACCOUNT_JSON" });
  }

  // Get OAuth2 access token
  const { createSign } = await import("crypto");
  function base64url(buf: Buffer | string) {
    const b = typeof buf === "string" ? Buffer.from(buf) : buf;
    return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  const now = Math.floor(Date.now() / 1000);
  const header  = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const sign = createSign("RSA-SHA256"); sign.update(unsigned);
  const jwt = `${unsigned}.${base64url(sign.sign(sa.private_key))}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json() as { access_token?: string };
  if (!tokenData.access_token) {
    console.error("[admin-notify] Failed to get FCM access token");
    return respond(res, { ok: true, sent: 0, warning: "Could not authenticate with Firebase" });
  }

  const accessToken = tokenData.access_token;
  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const tokens = rows.map(r => String(r.token));
  let sent = 0;

  await Promise.all(tokens.map(async (token) => {
    try {
      const r = await fetch(fcmUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body: msg },
            data: { type: "admin_broadcast" },
            webpush: { notification: { icon: "/logosk.jpg" } },
          },
        }),
      });
      if (r.ok) sent++;
      else console.warn("[fcm-v1] failed token:", token.slice(0, 10), r.status, await r.text().catch(() => ""));
    } catch (e) { console.error("[fcm-v1] error:", e); }
  }));

  respond(res, { ok: true, sent });
}


export async function handleAdminUserDetail(req: VercelRequest, res: VercelResponse, targetId: string): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  if (!(await checkRole(uid, "admin"))) return fail(res, "Недостатньо прав", 403);

  const row = await queryOne("SELECT * FROM users WHERE id = ? LIMIT 1", [targetId]);
  if (!row) return fail(res, "Користувача не знайдено", 404);
  await closeIdleSessions();
  const sessions = await query("SELECT id, started_at, last_active_at, ended_at, active_seconds, visits FROM activity_sessions WHERE user_id = ? ORDER BY started_at DESC", [targetId]);
  const summary = sessions.reduce((a, s) => ({ activeSeconds: a.activeSeconds + Number(s.active_seconds), visits: a.visits + Number(s.visits), lastActiveAt: String(s.last_active_at) > (a.lastActiveAt ?? "") ? String(s.last_active_at) : a.lastActiveAt }), { activeSeconds: 0, visits: 0, lastActiveAt: null as string | null });
  const prog = await ensureProgress(targetId);
  const userWords = await getUserWords(targetId);

  respond(res, {
    ok: true,
    user: { ...rowToUser(row), lastActiveAt: summary.lastActiveAt },
    progress: {
      userId:            targetId,
      currentLevel:      String(row.level),
      completedLessons:  safeJson<string[]>(String(prog.completed_j ?? "[]"), []),
      lessonAttempts:    [],
      xpTotal:           Number(prog.xp_total),
      xpWeekly:          Number(prog.xp_weekly),
      weekId:            String(prog.week_id ?? ""),
      xpDailyHistory:    safeJson<Record<string, number>>(String(prog.xp_daily_j ?? "{}"), {}),
      hearts:            Number(prog.hearts),
      maxHearts:         Number(prog.max_hearts),
      streakDays:        Number(prog.streak_days),
      lastPracticeDate:  prog.last_prac || undefined,
      streakFreezeCount: Number(prog.freeze_cnt),
      coins:             Number(prog.coins),
      mistakes:          safeJson<unknown[]>(String(prog.mistakes_j ?? "[]"), []),
      achievements:      [],
      updatedAt:         String(prog.updated_at),
    },
    userWords,
    activity: { ...summary, sessionCount: sessions.length, sessions },
  });
}

export async function handleAdminUserPatch(req: VercelRequest, res: VercelResponse, targetId: string, body: Record<string, unknown>): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  if (!(await checkRole(uid, "admin"))) return fail(res, "Недостатньо прав", 403);

  const sets: string[] = []; const vals: Arg[] = [];
  if ("role" in body)               { sets.push("role = ?");       vals.push(String(body.role)); }
  if ("isBlocked" in body)          { sets.push("is_blocked = ?"); vals.push(body.isBlocked ? 1 : 0); }
  if ("subscriptionStatus" in body) {
    const nextStatus = String(body.subscriptionStatus);
    sets.push("sub_status = ?"); vals.push(nextStatus);
    await ensureCol("users", "sub_expires_at", "TEXT");
    // A manual grant has no Stripe subscription behind it. If the learner ever
    // had one that lapsed, the stale sub_expires_at is still in the row, and
    // handleSyncPull knocks a "plus" with an expired date straight back to
    // "expired" — so the admin sees the grant applied while the learner stays
    // locked out. Clear the date along with the grant.
    if (nextStatus === "plus") sets.push("sub_expires_at = NULL");
  }
  if ("level" in body)              { sets.push("level = ?");      vals.push(String(body.level)); }
  if (!sets.length) return respond(res, { ok: true });

  sets.push("updated_at = ?"); vals.push(nowIso(), targetId);
  await exec(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, vals);
  const updated = await queryOne("SELECT * FROM users WHERE id = ? LIMIT 1", [targetId]);
  respond(res, { ok: true, user: updated ? rowToUser(updated) : null });
}

/** GET /admin/lessons/export?offset=&limit= — full lessons in pages (each page stays under the response limit). */
export async function handleAdminLessonsExport(req: VercelRequest, res: VercelResponse): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  if (!(await checkRole(uid, "admin", "teacher"))) return fail(res, "Недостатньо прав", 403);
  const url = new URL(req.url ?? "/admin/lessons/export", "http://localhost");
  const param = (k: string) => (typeof req.query?.[k] === "string" ? String(req.query[k]) : url.searchParams.get(k));
  const offset = Math.max(0, Math.floor(Number(param("offset") ?? 0)) || 0);
  const limit = Math.min(100, Math.max(1, Math.floor(Number(param("limit") ?? 100)) || 100));
  const total = Number((await queryOne("SELECT COUNT(*) AS n FROM lessons"))?.n ?? 0);
  const lessons = (await query("SELECT data_json FROM lessons ORDER BY rowid LIMIT ? OFFSET ?", [limit, offset]))
    .map((r) => safeJson(String(r.data_json), null)).filter(Boolean);
  respond(res, { ok: true, lessons, total, next: offset + lessons.length });
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
      validated.push(normalizeLessonPayload(raw) as unknown as ParsedLesson);
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
