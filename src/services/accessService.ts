import type { Lesson, Progress, SubscriptionStatus, UserLevel } from "../types";
import { lessonService } from "./lessonService";

const unrestrictedStatuses: SubscriptionStatus[] = ["trial", "plus"];

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
    if (this.hasCompletedFirstSectionAtAnyLevel(lessons, progress)) return false;
    return firstSectionForLevel(lessons, progress.currentLevel).some((lesson) => lesson.id === lessonId);
  },

  isFinalPreviewLesson(lessonId: string, lessons: Lesson[], progress: Progress, status: SubscriptionStatus): boolean {
    if (status !== "free" || this.hasCompletedFirstSectionAtAnyLevel(lessons, progress)) return false;
    const section = firstSectionForLevel(lessons, progress.currentLevel);
    const remaining = section.filter((lesson) => !progress.completedLessons.includes(lesson.id));
    return remaining.length === 1 && remaining[0]?.id === lessonId;
  }
};
