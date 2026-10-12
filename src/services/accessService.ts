import type { Lesson, Progress, SubscriptionStatus, UserLevel } from "../types";
import { canReadLesson, completedCount, FREE_LESSON_LIMIT, fullAccess, previewLessons } from "../../shared/access";

export const accessService = {
  hasFullAccess: fullAccess,
  firstPreviewLessons(lessons: Lesson[], level: UserLevel): Lesson[] { return previewLessons(lessons, level); },
  hasCompletedPreviewAtAnyLevel(_lessons: Lesson[], progress: Progress): boolean {
    return completedCount(progress.completedLessons) >= FREE_LESSON_LIMIT;
  },
  canUsePreview(_lessons: Lesson[], progress: Progress, status: SubscriptionStatus): boolean {
    return status === "free" && completedCount(progress.completedLessons) < FREE_LESSON_LIMIT;
  },
  canOpenLesson(id: string, lessons: Lesson[], progress: Progress, status: SubscriptionStatus): boolean {
    return canReadLesson(id, lessons, progress.completedLessons, progress.freePreviewLevel ?? progress.currentLevel, status);
  },
  isFinalPreviewLesson(id: string, lessons: Lesson[], progress: Progress, status: SubscriptionStatus): boolean {
    return status === "free" && completedCount(progress.completedLessons) === FREE_LESSON_LIMIT - 1
      && !progress.completedLessons.includes(id) && this.canOpenLesson(id, lessons, progress, status);
  }
};
