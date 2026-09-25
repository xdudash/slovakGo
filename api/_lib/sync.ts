import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Arg } from "./core";
import { normalizeLessonPayload } from "./lessonValidation";
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
  const url = new URL(req.url ?? "/sync/pull", "http://localhost");
  const includeLessonsParam = typeof req.query.includeLessons === "string" ? req.query.includeLessons : url.searchParams.get("includeLessons");
  const includeLessons = includeLessonsParam !== "0";
  const lessonVersion = await getLessonVersion(String(row.role));
  const lessons = includeLessons ? await getLessons(String(row.role)) : undefined;

  respond(res, {
    ok: true,
    user: rowToUser(row),
    progress: {
      userId:            uid,
      currentLevel:      String(row.level),
      completedLessons:  safeJson(String(prog.completed_j ?? "[]"), []),
      xpTotal:           Number(prog.xp_total),
      xpWeekly:          Number(prog.xp_weekly),
      weekId:            String(prog.week_id ?? ""),
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
    ...(lessons ? { lessons } : {}),
    lessonVersion,
    updatedAt: nowIso(),
  });
}

export async function handleLessonsPull(req: VercelRequest, res: VercelResponse): Promise<void> {
  const uid = await requireUid(req, res);
  if (!uid) return;

  const row = await queryOne("SELECT role FROM users WHERE id = ? LIMIT 1", [uid]);
  if (!row) return fail(res, "Користувача не знайдено", 404);

  const role = String(row.role);
  const version = await getLessonVersion(role);
  const url = new URL(req.url ?? "/lessons", "http://localhost");
  const currentVersion = typeof req.query.version === "string" ? req.query.version : url.searchParams.get("version");

  if (currentVersion === version) {
    return respond(res, { ok: true, unchanged: true, version });
  }

  respond(res, { ok: true, unchanged: false, version, lessons: await getLessons(role) });
}

async function getLessonVersion(role: string): Promise<string> {
  const privileged = role === "teacher" || role === "admin";
  const where = privileged ? "" : " WHERE published = 1";
  const row = await queryOne(`SELECT COUNT(*) AS count, MAX(updated_at) AS updated_at FROM lessons${where}`);
  return `${privileged ? "all" : "published"}:${Number(row?.count ?? 0)}:${String(row?.updated_at ?? "empty")}`;
}

class StaleMutationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaleMutationError";
  }
}

export async function handleSyncPush(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const uid  = await requireUid(req, res);
  if (!uid) return;
  const muts = Array.isArray(body.mutations) ? body.mutations as Record<string, unknown>[] : [];
  if (muts.length > 100) return fail(res, "Забагато мутацій", 413);
  const supported = new Set(["profile.update", "lesson.complete", "exercise.wrong", "word.update", "practice.complete", "hearts.restore", "lesson.upsert", "lesson.delete", "admin.user.update"]);
  if (muts.some(mut => !supported.has(String(mut.type ?? "")))) return fail(res, "Непідтримувана мутація", 422);
  if (muts.some(mut => mut.userId !== undefined && String(mut.userId) !== uid)) {
    return fail(res, "Мутація належить іншому користувачу", 403);
  }
  let applied = 0;
  let skipped = 0;

  for (const mut of muts) {
    if (!mut.id) continue;
    const mutId = String(mut.id).slice(0, 200);
    const logId = `${uid}:${mutId}`;
    const claim = await getDb().execute({
      sql: "INSERT OR IGNORE INTO sync_log (mutation_id, user_id, type, processed_at) VALUES (?, ?, ?, ?)",
      args: [logId, uid, String(mut.type ?? "").slice(0, 100), nowIso()],
    });
    if (claim.rowsAffected === 0) continue;
    try {
      await processMutation(uid, mut);
      applied++;
    } catch (err) {
      if (err instanceof StaleMutationError) {
        // The client may have queued a lesson completion while offline and the
        // lesson may have been unpublished/deleted before the queue drains.
        // Keep the mutation claimed so it is idempotently discarded and allow
        // the rest of the batch to continue instead of poisoning the queue.
        skipped++;
        continue;
      }
      await exec("DELETE FROM sync_log WHERE mutation_id = ? AND user_id = ?", [logId, uid]);
      throw err;
    }
  }
  
  if ((applied > 0 || skipped > 0) && Math.random() < 0.05) {
    const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString().replace(/\.\d{3}Z$/, "Z");
    exec("DELETE FROM sync_log WHERE processed_at < ?", [cutoff]).catch(() => undefined);
  }

  respond(res, { ok: true, applied, skipped });
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

const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;

function nextReviewDate(correctCount: number, afterMistake: boolean): string {
  const days = afterMistake
    ? REVIEW_INTERVAL_DAYS[0]
    : REVIEW_INTERVAL_DAYS[Math.min(correctCount, REVIEW_INTERVAL_DAYS.length - 1)];
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function touchServerWord(uid: string, wordId: string, correct: boolean): Promise<void> {
  if (!wordId) return;
  await ensureCol("user_words", "next_review", "TEXT");
  const existing = await queryOne(
    "SELECT status, mistakes, corrects, favorite FROM user_words WHERE user_id = ? AND word_id = ? LIMIT 1",
    [uid, wordId]
  );
  const previousCorrect = Number(existing?.corrects ?? 0);
  const previousMistakes = Number(existing?.mistakes ?? 0);
  const nextCorrect = correct ? previousCorrect + 1 : Math.max(0, previousCorrect - 1);
  const nextMistakes = Math.max(0, previousMistakes + (correct ? -1 : 1));
  const status = correct && nextCorrect >= 5 ? "mastered" : "practicing";
  const now = nowIso();
  const nextReview = nextReviewDate(nextCorrect, !correct);

  await exec(
    `INSERT INTO user_words (user_id, word_id, status, mistakes, corrects, favorite, last_seen, next_review)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, word_id) DO UPDATE SET
       status = excluded.status,
       mistakes = excluded.mistakes,
       corrects = excluded.corrects,
       last_seen = excluded.last_seen,
       next_review = excluded.next_review`,
    [uid, wordId, status, nextMistakes, nextCorrect, Number(existing?.favorite ?? 0), now, nextReview]
  );
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
  if (!lessonRow) throw new StaleMutationError("Unknown or unpublished lesson");

  const lesson = safeJson<Record<string, unknown>>(String(lessonRow.data_json), {});
  const exerciseCount = Array.isArray(lesson.exercises) ? lesson.exercises.length : 0;
  const finalSituation = (typeof lesson.finalSituation === "object" && lesson.finalSituation)
    ? lesson.finalSituation as Record<string, unknown>
    : null;
  const finalStepCount = finalSituation?.type === "interactive_scenario" && Array.isArray(finalSituation.steps)
    ? finalSituation.steps.length
    : 0;
  const expectedAnswerCount = exerciseCount + finalStepCount;
  const submittedAnswers = Array.isArray(p.answers) ? p.answers as Record<string, unknown>[] : [];
  if (submittedAnswers.length > (expectedAnswerCount || 100)) {
    throw new Error("Too many lesson answers");
  }

  const prog = await ensureProgress(uid);
  const userRow = await queryOne("SELECT * FROM users WHERE id = ? LIMIT 1", [uid]);
  if (!userRow) throw new Error("Unknown user");

  const completed: string[] = safeJson(String(prog.completed_j ?? "[]"), []);
  const alreadyCompleted = completed.includes(lessonId);
  const reward = Math.max(0, Number(lesson.xpReward ?? 10) || 10);
  const baseXp = alreadyCompleted ? Math.max(3, Math.round(reward * 0.25)) : reward;
  const status = String(rowToUser(userRow).subscriptionStatus ?? "");
  const xpEarned = status === "plus" || status === "trial" || status === "past_due" ? Math.round(baseXp * 1.5) : baseXp;

  const today = todayKey();
  const weekId = currentWeekId();
  const xpW = String(prog.week_id) === weekId ? Number(prog.xp_weekly) : 0;
  const lastP = String(prog.last_prac ?? "");
  let streak = Number(prog.streak_days);
  let freeze = Number(prog.freeze_cnt);

  if (lastP !== today) {
    if (!lastP) {
      streak = 1;
    } else {
      const yest = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
      if (lastP === yest) streak += 1;
      else if (freeze > 0) freeze -= 1;
      else streak = 1;
    }
  }

  const xpDaily: Record<string, number> = safeJson(String(prog.xp_daily_j ?? "{}"), {});
  xpDaily[today] = (xpDaily[today] ?? 0) + xpEarned;
  if (!alreadyCompleted) completed.push(lessonId);

  await exec(
    `UPDATE progress SET xp_total = xp_total + ?, xp_weekly = ?, xp_daily_j = ?, week_id = ?,
       streak_days = ?, last_prac = ?, freeze_cnt = ?, completed_j = ?, updated_at = ? WHERE user_id = ?`,
    [xpEarned, xpW + xpEarned, JSON.stringify(xpDaily), weekId, streak, today, freeze, JSON.stringify(completed), nowIso(), uid]
  );

  const words = Array.isArray(lesson.words) ? lesson.words as Record<string, unknown>[] : [];
  for (const word of words) {
    if (word?.id) await touchServerWord(uid, String(word.id), true);
  }
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
  const prog = await ensureProgress(uid);
  const userRow = await queryOne("SELECT * FROM users WHERE id = ? LIMIT 1", [uid]);
  if (!userRow) throw new Error("Unknown user");

  await ensureCol("progress", "practice_awarded_at", "TEXT");
  const status = String(rowToUser(userRow).subscriptionStatus ?? "");
  const xpEarned = status === "plus" || status === "trial" || status === "past_due"
    ? Math.round(XP_PER_PRACTICE * 1.5)
    : XP_PER_PRACTICE;

  const today = todayKey();
  const weekId = currentWeekId();
  const xpW = String(prog.week_id) === weekId ? Number(prog.xp_weekly) : 0;
  const lastP = String(prog.last_prac ?? "");
  let streak = Number(prog.streak_days);
  let freeze = Number(prog.freeze_cnt);

  if (lastP !== today) {
    if (!lastP) {
      streak = 1;
    } else {
      const yest = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
      if (lastP === yest) streak += 1;
      else if (freeze > 0) freeze -= 1;
      else streak = 1;
    }
  }

  const xpDaily: Record<string, number> = safeJson(String(prog.xp_daily_j ?? "{}"), {});
  xpDaily[today] = (xpDaily[today] ?? 0) + xpEarned;

  await exec(
    `UPDATE progress SET xp_total = xp_total + ?, xp_weekly = ?, xp_daily_j = ?, week_id = ?,
       streak_days = ?, last_prac = ?, freeze_cnt = ?, practice_awarded_at = ?, updated_at = ? WHERE user_id = ?`,
    [xpEarned, xpW + xpEarned, JSON.stringify(xpDaily), weekId, streak, today, freeze, nowIso(), nowIso(), uid]
  );

  for (const r of results) {
    if (!r.wordId) continue;
    await touchServerWord(uid, String(r.wordId), Boolean(r.correct));
  }
}
async function mutLessonUpsert(uid: string, p: Record<string, unknown>): Promise<void> {
  const rawLesson = (typeof p.lesson === "object" && p.lesson) ? p.lesson : p;
  const lesson = normalizeLessonPayload(rawLesson);
  await exec(
    `INSERT INTO lessons (id, data_json, published, created_by, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, published = excluded.published, updated_at = excluded.updated_at`,
    [lesson.id, JSON.stringify(lesson), lesson.isPublished ? 1 : 0, uid, nowIso()]
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
