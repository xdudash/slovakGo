import type { Lesson, Progress, SubscriptionStatus, UserLevel } from "../types";
import { lessonService } from "./lessonService";

// `past_due` keeps full access on purpose: Stripe is still retrying the card and
// most of those payments recover. Locking a paying learner out on the first
// failed charge loses the subscription that would have renewed by itself.
const unrestrictedStatuses: SubscriptionStatus[] = ["trial", "plus", "past_due"];

function firstSectionForLevel(lessons: Lesson[], level: UserLevel): Lesson[] {
  const levelLessons = lessonService.byLevel(lessons, level);
  const first = levelLessons[0];
  if (!first) return [];
  const topic = first.topic;
  const section: Lesson[] = [];
  for (const lesson of levelLessons) {
    if (section.length > 0 && lesson.topic !== topic) break;
    section.push(lesson);
  }
  return section;
}

export const accessService = {
  hasFullAccess(status: SubscriptionStatus): boolean {
    return unrestrictedStatuses.includes(status);
  },

  firstSection(lessons: Lesson[], level: UserLevel): Lesson[] {
    return firstSectionForLevel(lessons, level);
  },

  hasCompletedFirstSectionAtAnyLevel(lessons: Lesson[], progress: Progress): boolean {
    return lessonService.levels.some((level) => {
      const section = firstSectionForLevel(lessons, level);
      return section.length > 0 && section.every((lesson) => progress.completedLessons.includes(lesson.id));
    });
  },

  canUsePreview(lessons: Lesson[], progress: Progress, status: SubscriptionStatus): boolean {
    return status === "free" && !this.hasCompletedFirstSectionAtAnyLevel(lessons, progress);
  },

  canOpenLesson(lessonId: string, lessons: Lesson[], progress: Progress, status: SubscriptionStatus): boolean {
    if (this.hasFullAccess(status)) return true;
    if (status !== "free") return false;
    const previewLesson = lessonService.levels
      .flatMap((level) => firstSectionForLevel(lessons, level))
      .find((lesson) => lesson.id === lessonId);
    if (!previewLesson) return false;

    // Keep an already completed preview lesson mounted long enough to show its
    // result screen. This also lets a learner repeat the section they already
    // earned, while the path and every paid feature remain locked.
    if (progress.completedLessons.includes(lessonId)) return true;
    if (this.hasCompletedFirstSectionAtAnyLevel(lessons, progress)) return false;
    return previewLesson.level === progress.currentLevel;
  },

  isFinalPreviewLesson(lessonId: string, lessons: Lesson[], progress: Progress, status: SubscriptionStatus): boolean {
    if (status !== "free" || this.hasCompletedFirstSectionAtAnyLevel(lessons, progress)) return false;
    const section = firstSectionForLevel(lessons, progress.currentLevel);
    const remaining = section.filter((lesson) => !progress.completedLessons.includes(lesson.id));
    return remaining.length === 1 && remaining[0]?.id === lessonId;
  }
};
