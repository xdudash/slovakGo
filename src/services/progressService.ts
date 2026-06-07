import type { AnswerRecord, Exercise, Lesson, Progress, UserWord } from "../types";
import { currentWeekId, isToday, isYesterday, todayKey } from "../utils/date";

function sameAnswer(expected: string | string[], answer: string | string[]): boolean {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/[.!?]/g, "");
  if (Array.isArray(expected)) {
    if (!Array.isArray(answer)) return false;
    return expected.map(normalize).sort().join("|") === answer.map(normalize).sort().join("|");
  }
  return normalize(String(answer)) === normalize(String(expected));
}

function resetWeeklyIfNeeded(progress: Progress): Progress {
  const week = currentWeekId();
  if (!progress.weekId) return { ...progress, weekId: week };
  if (progress.weekId === week) return progress;
  return { ...progress, xpWeekly: 0, weekId: week };
}

function updateStreak(progress: Progress): Progress {
  if (isToday(progress.lastPracticeDate)) return progress;
  if (isYesterday(progress.lastPracticeDate)) {
    return { ...progress, streakDays: progress.streakDays + 1, lastPracticeDate: new Date().toISOString() };
  }
  if (progress.lastPracticeDate && progress.streakFreezeCount > 0) {
    return {
      ...progress,
      streakFreezeCount: progress.streakFreezeCount - 1,
      lastPracticeDate: new Date().toISOString()
    };
  }
  return { ...progress, streakDays: 1, lastPracticeDate: new Date().toISOString() };
}

export const progressService = {
  check(exercise: Exercise, answer: string | string[]): boolean {
    return sameAnswer(exercise.correctAnswer, answer);
  },

  wrong(progress: Progress, lesson: Lesson, exercise: Exercise, answer: string): Progress {
    const wordId = exercise.wordIds?.[0];
    return {
      ...progress,
      hearts: Math.max(0, progress.hearts - 1),
      mistakes: [
        ...progress.mistakes,
        {
          id: crypto.randomUUID(),
          userId: progress.userId,
          lessonId: lesson.id,
          exerciseId: exercise.id,
          wordId,
          wrongAnswer: answer,
          correctAnswer: Array.isArray(exercise.correctAnswer) ? exercise.correctAnswer.join(", ") : exercise.correctAnswer,
          createdAt: new Date().toISOString(),
          repeatCount: 1
        }
      ],
      updatedAt: new Date().toISOString()
    };
  },

  completeLesson(progress: Progress, lesson: Lesson, answers: AnswerRecord[]): Progress {
    const p = resetWeeklyIfNeeded(progress);
    const alreadyCompleted = p.completedLessons.includes(lesson.id);
    const correct = answers.filter((answer) => answer.correct).length;
    const mistakes = answers.length - correct;
    const xpEarned = alreadyCompleted ? Math.max(3, Math.round(lesson.xpReward * 0.25)) : lesson.xpReward;
    const updated = updateStreak(p);
    return {
      ...updated,
      completedLessons: alreadyCompleted ? p.completedLessons : [...p.completedLessons, lesson.id],
      currentLessonId: lesson.id,
      xpTotal: updated.xpTotal + xpEarned,
      xpWeekly: updated.xpWeekly + xpEarned,
      lessonAttempts: [
        ...updated.lessonAttempts,
        {
          id: crypto.randomUUID(),
          userId: progress.userId,
          lessonId: lesson.id,
          startedAt: answers[0]?.answeredAt || new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          score: answers.length ? Math.round((correct / answers.length) * 100) : 0,
          mistakesCount: mistakes,
          heartsLost: mistakes,
          xpEarned,
          answers,
          completed: true
        }
      ],
      achievements: this.achievements(updated.streakDays, updated.achievements),
      updatedAt: new Date().toISOString()
    };
  },

  touchWord(userId: string, wordId: string, words: UserWord[], correct: boolean): UserWord[] {
    const existing = words.find((word) => word.wordId === wordId);
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + (correct ? 4 : 1));
    const next: UserWord = {
      userId,
      wordId,
      status: correct ? ((existing?.correctCount || 0) + 1 >= 3 ? "mastered" : "practicing") : "practicing",
      mistakeCount: Math.max(0, (existing?.mistakeCount || 0) + (correct ? -1 : 1)),
      correctCount: (existing?.correctCount || 0) + (correct ? 1 : 0),
      favorite: !!existing?.favorite,
      lastSeenAt: new Date().toISOString(),
      nextReviewAt: nextReview.toISOString()
    };
    return [...words.filter((word) => word.wordId !== wordId), next];
  },

  achievements(streakDays: number, existing: Progress["achievements"]) {
    const goals = [3, 7, 14, 30];
    const owned = new Set(existing.map((achievement) => achievement.id));
    const earned = goals
      .filter((goal) => streakDays >= goal && !owned.has(`streak-${goal}`))
      .map((goal) => ({ id: `streak-${goal}`, title: `${goal} днів серії`, earnedAt: new Date().toISOString() }));
    return [...existing, ...earned];
  },

  restoreHearts(progress: Progress): Progress {
    return { ...progress, hearts: progress.maxHearts, updatedAt: new Date().toISOString() };
  },

  practiceDone(progress: Progress): Progress {
    const p = resetWeeklyIfNeeded(progress);
    const updated = updateStreak(p);
    return {
      ...updated,
      xpTotal: updated.xpTotal + 5,
      xpWeekly: updated.xpWeekly + 5,
      lastPracticeDate: todayKey(),
      updatedAt: new Date().toISOString()
    };
  }
};
