import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Arg } from "./core";
import {
  XP_PER_PRACTICE,
  exec, queryOne, nowIso, todayKey, currentWeekId, safeJson,
  requireUid, respond, fail, rowToUser, ensureProgress,
  getUserWords, getLessons, checkRole
} from "./core";

export async function handleSyncPull(req: VercelRequest, res: VercelResponse): Promise<void> {
  const uid = await requireUid(req, res);
  if (!uid) return;

  let row = await queryOne("SELECT * FROM users WHERE id = ? LIMIT 1", [uid]);
  if (!row) return fail(res, "Користувача не знайдено", 404);

  if (String(row.sub_status) === "trial" && row.trial_ends) {
    if (Date.now() > new Date(String(row.trial_ends)).getTime()) {
      await exec("UPDATE users SET sub_status = 'free', updated_at = ? WHERE id = ?", [nowIso(), uid]);
      row = await queryOne("SELECT * FROM users WHERE id = ? LIMIT 1", [uid]);
      if (!row) return fail(res, "Користувача не знайдено", 404);
    }
  }
  if (String(row.sub_status) === "plus" && row.sub_expires_at) {
    if (Date.now() > new Date(String(row.sub_expires_at)).getTime()) {
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

export async function handleSyncPush(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
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
  
  if (applied > 0 && Math.random() < 0.05) {
    const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString().replace(/\.\d{3}Z$/, "Z");
    exec("DELETE FROM sync_log WHERE processed_at < ?", [cutoff]).catch(() => undefined);
  }

  respond(res, { ok: true, applied });
}

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
    [id, String(u.email).toLowerCase().trim(), String(u.name ?? ""), "student",
     String(u.level ?? "A0"), u.goal ? String(u.goal) : null, "trial",
     u.onboardingDone ? 1 : 0, JSON.stringify(u.settings ?? {}), now, now]
  );
  await ensureProgress(id);
}

async function mutProfileUpdate(uid: string, p: Record<string, unknown>): Promise<void> {
  const sets: string[] = []; const vals: Arg[] = [];
  if ("name" in p)           { sets.push("name_text = ?");  vals.push(String(p.name ?? "").trim().slice(0, 100)); }
  if ("goal" in p)           { sets.push("goal = ?");       vals.push(p.goal ? String(p.goal).trim().slice(0, 200) : null); }
  if ("level" in p)          { sets.push("level = ?");      vals.push(String(p.level)); }
  if ("avatar" in p) {
    const av = String(p.avatar ?? "").slice(0, 100);
    if (!av || !/https?:|data:|javascript:/i.test(av)) { sets.push("avatar = ?"); vals.push(av || null); }
  }
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
  const clientXp = typeof p.xpEarned === "number" && p.xpEarned > 0 ? p.xpEarned : null;
  const xpEarned = clientXp !== null
    ? Math.min(clientXp, 500)
    : Math.max(10, answers.length > 0 ? answers.length * 5 - wrong * 3 : 10);

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
