import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Arg } from "./core";
import {
  XP_PER_PRACTICE,
  exec, queryOne, nowIso, todayKey, currentWeekId, safeJson, getDb, ensureCol,
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
      await exec("UPDATE users SET sub_status = 'expired', updated_at = ? WHERE id = ?", [nowIso(), uid]);
      row = await queryOne("SELECT * FROM users WHERE id = ? LIMIT 1", [uid]);
      if (!row) return fail(res, "Користувача не знайдено", 404);
    }
  }
  if (String(row.sub_status) === "plus" && row.sub_expires_at) {
    if (Date.now() > new Date(String(row.sub_expires_at)).getTime()) {
      await exec("UPDATE users SET sub_status = 'expired', updated_at = ? WHERE id = ?", [nowIso(), uid]);
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
  if (muts.length > 100) return fail(res, "Забагато мутацій", 413);
  const supported = new Set(["profile.update", "lesson.complete", "exercise.wrong", "word.update", "practice.complete", "hearts.restore", "lesson.upsert", "lesson.delete", "admin.user.update"]);
  if (muts.some(mut => !supported.has(String(mut.type ?? "")))) return fail(res, "Непідтримувана мутація", 422);
  let applied = 0;

  for (const mut of muts) {
    if (!mut.id) continue;
    const mutId = String(mut.id).slice(0, 200);
    const logId = `${uid}:${mutId}`;
    const claim = await getDb().execute({
      sql: "INSERT OR IGNORE INTO sync_log (mutation_id, user_id, type, processed_at) VALUES (?, ?, ?, ?)",
      args: [logId, uid, String(mut.type ?? "").slice(0, 100), nowIso()],
    });
    if (claim.rowsAffected === 0) continue;
    try { await processMutation(uid, mut); applied++; }
    catch (err) { await exec("DELETE FROM sync_log WHERE mutation_id = ? AND user_id = ?", [logId, uid]); throw err; }
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
    case "profile.update":    await mutProfileUpdate(uid, p); break;
    case "lesson.complete":   await mutLessonComplete(uid, p); break;
    case "exercise.wrong":    await mutExerciseWrong(uid, p); break;
    case "word.update":       await mutWordUpdate(uid, p); break;
    case "practice.complete": await mutPracticeComplete(uid, p); break;
    case "hearts.restore":    await mutRestoreHearts(uid); break;
    case "lesson.upsert":
      if (!(await checkRole(uid, "teacher", "admin"))) throw new Error("Insufficient role");
      await mutLessonUpsert(uid, p);
      break;
    case "lesson.delete":
      if (!(await checkRole(uid, "teacher", "admin"))) throw new Error("Insufficient role");
      if (p.lessonId) await exec("DELETE FROM lessons WHERE id = ?", [String(p.lessonId)]);
      break;
    case "admin.user.update":
      if (!(await checkRole(uid, "admin"))) throw new Error("Insufficient role");
      await mutAdminUserUpdate(p);
      break;
    default: throw new Error(`Unsupported sync mutation: ${type}`);
  }
}

async function mutRestoreHearts(uid: string): Promise<void> {
  await ensureCol("progress", "hearts_restored_at", "TEXT");
  const now = nowIso();
  await exec(
    `UPDATE progress SET hearts = max_hearts, hearts_restored_at = ?, updated_at = ?
     WHERE user_id = ? AND (hearts_restored_at IS NULL OR substr(hearts_restored_at, 1, 10) < ?)`,
    [now, now, uid, todayKey()]
  );
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
  const lessonRow = lessonId ? await queryOne("SELECT data_json FROM lessons WHERE id = ? AND published = 1 LIMIT 1", [lessonId]) : null;
  if (!lessonRow) throw new Error("Unknown or unpublished lesson");
  const lesson = safeJson<Record<string, unknown>>(String(lessonRow.data_json), {});
  const exerciseCount = Array.isArray(lesson.exercises) ? lesson.exercises.length : 0;
  const answers = (Array.isArray(p.answers) ? p.answers as Record<string, unknown>[] : []).slice(0, exerciseCount || 100);
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
  if (completed.includes(lessonId)) return;
  completed.push(lessonId);

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
  await ensureCol("progress", "practice_awarded_at", "TEXT");
  const lastAward = prog.practice_awarded_at ? new Date(String(prog.practice_awarded_at)).getTime() : 0;
  if (Date.now() - lastAward < 30_000) return;
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
       streak_days = ?, last_prac = ?, practice_awarded_at = ?, updated_at = ? WHERE user_id = ?`,
    [XP_PER_PRACTICE, xpW + XP_PER_PRACTICE, JSON.stringify(xpDaily), weekId, streak, today, nowIso(), nowIso(), uid]
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
