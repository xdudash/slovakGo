import { canReadLesson, fullAccess, type AccessLesson } from "../../shared/access";
import { ensureProgress, ensureCol, exec, getLessonIndex, getLessons, queryOne, rowToUser, safeJson } from "./core";

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
export async function accessibleLessons(uid: string): Promise<unknown[]> {
  const { user, canRead } = await lessonAccess(uid);
  const lessons = await getLessons(String(user.role)) as (AccessLesson & Record<string, unknown>)[];
  return lessons.map(l => canRead(l.id) ? l : ({
    id: l.id, level: l.level, order: l.order, title: l.title, topic: l.topic,
    description: "", xpReward: l.xpReward, estimatedMinutes: l.estimatedMinutes,
    isPublished: l.isPublished, isLocked: true, contentLocked: true, words: [], exercises: [], updatedAt: l.updatedAt,
  }));
}
export async function assertLessonAccess(uid: string, id: string): Promise<void> {
  if (!(await lessonAccess(uid)).canRead(id)) throw new AccessDeniedError("Потрібна підписка для цього уроку");
}
