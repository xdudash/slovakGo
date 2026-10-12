/** Shared by the API and browser. The allowance belongs to the account, not a topic. */
export const FREE_LESSON_LIMIT = 10;
export interface AccessLesson { id: string; level: string; order: number; isPublished: boolean }
export function previewLessons<T extends AccessLesson>(lessons: T[], level: string): T[] {
  const levels = ["A0", "A1", "A2", "B1", "B2", "C1"];
  const start = levels.indexOf(level);
  return lessons.filter(l => l.isPublished && levels.indexOf(l.level) >= start)
    .sort((a, b) => levels.indexOf(a.level) - levels.indexOf(b.level) || a.order - b.order || a.id.localeCompare(b.id))
    .slice(0, FREE_LESSON_LIMIT);
}
export function completedCount(completed: string[]): number { return new Set(completed).size; }
export function fullAccess(status: string): boolean { return ["plus", "trial", "past_due"].includes(status); }
export function canReadLesson(id: string, lessons: AccessLesson[], completed: string[], level: string, status: string): boolean {
  const lesson = lessons.find(l => l.id === id && l.isPublished);
  if (!lesson) return false;
  if (fullAccess(status)) return true;
  if (status !== "free") return false;
  if (completed.includes(id)) return true;
  return completedCount(completed) < FREE_LESSON_LIMIT && previewLessons(lessons, level).some(l => l.id === id);
}
