import type { AnswerRecord, Exercise, Lesson, Progress, SubscriptionStatus, UserWord } from "../types";
import { currentWeekId, isToday, isYesterday, todayKey } from "../utils/date";
import { srService } from "./spacedRepetitionService";

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

function addDailyXp(progress: Progress, amount: number): Progress {
  const today = todayKey();
  const h = progress.xpDailyHistory ?? {};
  return { ...progress, xpDailyHistory: { ...h, [today]: (h[today] ?? 0) + amount } };
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

function xpWithBonus(base: number, subscriptionStatus?: SubscriptionStatus): number {
  return subscriptionStatus === "plus" ? Math.round(base * 1.5) : base;
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

  completeLesson(
    progress: Progress,
    lesson: Lesson,
    answers: AnswerRecord[],
    subscriptionStatus?: SubscriptionStatus
  ): Progress {
    const p = resetWeeklyIfNeeded(progress);
    const alreadyCompleted = p.completedLessons.includes(lesson.id);
    const correct = answers.filter((answer) => answer.correct).length;
    const mistakes = answers.length - correct;
    const baseXp = alreadyCompleted ? Math.max(3, Math.round(lesson.xpReward * 0.25)) : lesson.xpReward;
    const xpEarned = xpWithBonus(baseXp, subscriptionStatus);
    const updated = addDailyXp(updateStreak(p), xpEarned);
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
    const newCorrectCount = correct
      ? (existing?.correctCount ?? 0) + 1
      : Math.max(0, (existing?.correctCount ?? 0) - 1);
    const next: UserWord = {
      userId,
      wordId,
      // Mastered after 5 consecutive correct answers
      status: correct ? (newCorrectCount >= 5 ? "mastered" : "practicing") : "practicing",
      mistakeCount: Math.max(0, (existing?.mistakeCount ?? 0) + (correct ? -1 : 1)),
      correctCount: newCorrectCount,
      favorite: !!existing?.favorite,
      lastSeenAt: new Date().toISOString(),
      nextReviewAt: srService.nextReviewDate(newCorrectCount, !correct),
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

  practiceDone(progress: Progress, subscriptionStatus?: SubscriptionStatus): Progress {
    const xpEarned = xpWithBonus(5, subscriptionStatus);
    const p = resetWeeklyIfNeeded(progress);
    const updated = addDailyXp(updateStreak(p), xpEarned);
    return {
      ...updated,
      xpTotal: updated.xpTotal + xpEarned,
      xpWeekly: updated.xpWeekly + xpEarned,
      lastPracticeDate: todayKey(),
      updatedAt: new Date().toISOString()
    };
  }
};
