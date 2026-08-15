import type { Lesson, Progress, SubscriptionStatus, UserLevel } from "../types";
import { lessonService } from "./lessonService";

// `past_due` keeps full access on purpose: Stripe is still retrying the card and
// most of those payments recover. Locking a paying learner out on the first
// failed charge loses the subscription that would have renewed by itself.
const unrestrictedStatuses: SubscriptionStatus[] = ["trial", "plus", "past_due"];

function firstPreviewLessons(lessons: Lesson[], level: UserLevel): Lesson[] {
  return lessonService.byLevel(lessons, level).slice(0, 5);
}

export const accessService = {
  hasFullAccess(status: SubscriptionStatus): boolean {
    return unrestrictedStatuses.includes(status);
  },

  firstPreviewLessons(lessons: Lesson[], level: UserLevel): Lesson[] {
    return firstPreviewLessons(lessons, level);
  },

  hasCompletedPreviewAtAnyLevel(lessons: Lesson[], progress: Progress): boolean {
    return lessonService.levels.some((level) => {
      const section = firstPreviewLessons(lessons, level);
      return section.length > 0 && section.every((lesson) => progress.completedLessons.includes(lesson.id));
    });
  },

  canUsePreview(lessons: Lesson[], progress: Progress, status: SubscriptionStatus): boolean {
    return status === "free" && !this.hasCompletedPreviewAtAnyLevel(lessons, progress);
  },

  canOpenLesson(lessonId: string, lessons: Lesson[], progress: Progress, status: SubscriptionStatus): boolean {
    if (this.hasFullAccess(status)) return true;
    if (status !== "free") return false;
    const previewLesson = lessonService.levels
      .flatMap((level) => firstPreviewLessons(lessons, level))
      .find((lesson) => lesson.id === lessonId);
    if (!previewLesson) return false;

    // Keep an already completed preview lesson mounted long enough to show its
    // result screen. This also lets a learner repeat the section they already
    // earned, while the path and every paid feature remain locked.
    if (progress.completedLessons.includes(lessonId)) return true;
    if (this.hasCompletedPreviewAtAnyLevel(lessons, progress)) return false;
    return previewLesson.level === progress.currentLevel;
  },

  isFinalPreviewLesson(lessonId: string, lessons: Lesson[], progress: Progress, status: SubscriptionStatus): boolean {
    if (status !== "free" || this.hasCompletedPreviewAtAnyLevel(lessons, progress)) return false;
    const section = firstPreviewLessons(lessons, progress.currentLevel);
    const remaining = section.filter((lesson) => !progress.completedLessons.includes(lesson.id));
    return remaining.length === 1 && remaining[0]?.id === lessonId;
  }
};
