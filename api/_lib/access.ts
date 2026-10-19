import { canReadLesson, fullAccess, type AccessLesson } from "../../shared/access";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureProgress, ensureCol, exec, fail, getLessonIndex, getLessonShells, query, queryOne, requireUid, respond, rowToUser, safeJson } from "./core";

export class AccessDeniedError extends Error {}
export async function lessonAccess(uid: string) {
  await ensureCol("users", "free_preview_level", "TEXT");
  let user = await queryOne("SELECT * FROM users WHERE id = ?", [uid]);
  if (!user) throw new AccessDeniedError("User not found");
  // Freeze the free catalog once onboarding chooses the starting level. Existing
  // learners keep their current level. Profile changes cannot unlock another catalog.
  if (user.ob_done && !user.free_preview_level) {
    await exec("UPDATE users SET free_preview_level=level WHERE id=? AND free_preview_level IS NULL", [uid]);
    user = (await queryOne("SELECT * FROM users WHERE id = ?", [uid]))!;
  }
  const privileged = ["teacher", "admin"].includes(String(user.role));
  const lessons: AccessLesson[] = await getLessonIndex(String(user.role));
  const progress = await ensureProgress(uid);
  const completed = safeJson<string[]>(String(progress.completed_j ?? "[]"), []);
  const canRead = (id: string) => privileged || fullAccess(String(rowToUser(user).subscriptionStatus)) || (Boolean(user.ob_done) && canReadLesson(id, lessons, completed, String(user.free_preview_level ?? user.level), String(rowToUser(user).subscriptionStatus)));
  return { user, lessons, completed, canRead };
}
/**
 * The lesson catalog. Locked lessons are metadata only. Readable lessons carry
 * full content for free learners (at most ~10 lessons); learners with full
 * access, teachers and admins can read 1000+ lessons, so they get shells marked
 * `contentDeferred` and load each lesson's content when they open it.
 */
export async function accessibleLessons(uid: string): Promise<unknown[]> {
  const { user, canRead } = await lessonAccess(uid);
  const privileged = ["teacher", "admin"].includes(String(user.role));
  const deferAll = privileged || fullAccess(String(rowToUser(user).subscriptionStatus));
  const shells = await getLessonShells(String(user.role)) as (AccessLesson & Record<string, unknown>)[];
  const fullById = new Map<string, Record<string, unknown>>();
  if (!deferAll) {
    const ids = shells.filter(l => canRead(l.id)).map(l => l.id);
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      for (const r of await query(`SELECT id, data_json FROM lessons WHERE id IN (${chunk.map(() => "?").join(",")})`, chunk)) {
        const lesson = safeJson<Record<string, unknown> | null>(String(r.data_json), null);
        if (lesson) fullById.set(String(r.id), lesson);
      }
    }
  }
  return shells.map(l => {
    if (!canRead(l.id)) return {
      id: l.id, level: l.level, order: l.order, title: l.title, topic: l.topic,
      description: "", xpReward: l.xpReward, estimatedMinutes: l.estimatedMinutes,
      isPublished: l.isPublished, isLocked: true, contentLocked: true, words: [], exercises: [], updatedAt: l.updatedAt,
    };
    return fullById.get(l.id) ?? { ...l, exercises: [], contentDeferred: true };
  });
}

/** GET /lessons/:id — full content of one lesson the user may read. */
export async function handleLessonGet(req: VercelRequest, res: VercelResponse, id: string): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  const { canRead } = await lessonAccess(uid);
  if (!canRead(id)) return fail(res, "Потрібна підписка для цього уроку", 403);
  const row = await queryOne("SELECT data_json FROM lessons WHERE id = ? LIMIT 1", [id]);
  const lesson = row ? safeJson<Record<string, unknown> | null>(String(row.data_json), null) : null;
  if (!lesson) return fail(res, "Урок не знайдено", 404);
  respond(res, { ok: true, lesson });
}
export async function assertLessonAccess(uid: string, id: string): Promise<void> {
  if (!(await lessonAccess(uid)).canRead(id)) throw new AccessDeniedError("Потрібна підписка для цього уроку");
}
