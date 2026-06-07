import type { Lesson, Progress, UserLevel } from "../types";

const levelOrder: UserLevel[] = ["A0", "A1", "A2", "B1", "B2", "C1"];

export const lessonService = {
  levels: levelOrder,

  getPublished(lessons: Lesson[]) {
    return lessons
      .filter((lesson) => lesson.isPublished)
      .sort((a, b) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level) || a.order - b.order);
  },

  byLevel(lessons: Lesson[], level: UserLevel) {
    return this.getPublished(lessons).filter((lesson) => lesson.level === level);
  },

  isLessonUnlocked(lesson: Lesson, lessons: Lesson[], progress: Progress): boolean {
    if (progress.completedLessons.includes(lesson.id)) return true;
    const levelLessons = this.byLevel(lessons, lesson.level);
    const index = levelLessons.findIndex((item) => item.id === lesson.id);
    if (index === 0 && levelOrder.indexOf(lesson.level) <= levelOrder.indexOf(progress.currentLevel)) return true;
    const previous = levelLessons[index - 1];
    return !!previous && progress.completedLessons.includes(previous.id);
  },

  status(lesson: Lesson, lessons: Lesson[], progress: Progress): "completed" | "current" | "locked" | "available" {
    if (progress.completedLessons.includes(lesson.id)) return "completed";
    if (!this.isLessonUnlocked(lesson, lessons, progress)) return "locked";
    if (progress.currentLessonId === lesson.id) return "current";
    return "available";
  },

  levelProgress(lessons: Lesson[], progress: Progress, level: UserLevel): number {
    const levelLessons = this.byLevel(lessons, level);
    if (!levelLessons.length) return 0;
    const completed = levelLessons.filter((lesson) => progress.completedLessons.includes(lesson.id)).length;
    return Math.round((completed / levelLessons.length) * 100);
  }
};
