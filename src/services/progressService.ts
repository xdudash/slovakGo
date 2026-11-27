import type { AnswerRecord, Exercise, Lesson, Progress, SubscriptionStatus, UserWord } from "../types";
import { currentWeekId, dateDay, isToday, isYesterday, todayKey } from "../utils/date";
import { srService } from "./spacedRepetitionService";
import { checkNewExercise, formatCorrectAnswer } from "./exerciseChecking";
import { MAX_FREEZES, chestReady, chestReward, dailyFor, isPerfectRun, itemPrice, lessonCrowns, liveStreak, practiceCrowns, streakMilestone } from "../../shared/economy";

/** Streak milestone crowns, the Comet frame at 30 days and today's chest counters. */
function withSessionExtras(before: Progress, after: Progress, kind: "lesson" | "practice"): Progress {
  const milestone = streakMilestone(before.streakDays, after.streakDays);
  const owned = after.ownedItems ?? [];
  const daily = dailyFor(after.daily, todayKey());
  return {
    ...after,
    coins: (after.coins ?? 0) + (milestone?.crowns ?? 0),
    ownedItems: milestone?.days === 30 && !owned.includes("comet") ? [...owned, "comet"] : owned,
    daily: { ...daily, lessons: daily.lessons + (kind === "lesson" ? 1 : 0), practices: daily.practices + (kind === "practice" ? 1 : 0) },
  };
}

function sameAnswer(expected: string | string[] | boolean | undefined, answer: string | string[]): boolean {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/[.!?]/g, "");
  if (expected === undefined || expected === null) return false;
  if (Array.isArray(expected)) {
    if (Array.isArray(answer)) {
      return expected.map(normalize).sort().join("|") === answer.map(normalize).sort().join("|");
    }
    return expected.some((item) => normalize(String(item)) === normalize(String(answer)));
  }
  if (Array.isArray(answer)) {
    return answer.length === 1 && normalize(String(answer[0])) === normalize(String(expected));
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
  return subscriptionStatus === "plus" || subscriptionStatus === "trial" || subscriptionStatus === "past_due"
    ? Math.round(base * 1.5)
    : base;
}

export const progressService = {
  check(exercise: Exercise, answer: string | string[]): boolean {
    const newResult = checkNewExercise(exercise, answer);
    if (newResult !== undefined) return newResult;
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
          correctAnswer: formatCorrectAnswer(exercise),
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
    const heartsLost = answers.filter(
      (answer) => !answer.correct && !answer.exerciseId.startsWith("final:")
    ).length;
    const baseXp = alreadyCompleted ? Math.max(3, Math.round(lesson.xpReward * 0.25)) : lesson.xpReward;
    const xpEarned = xpWithBonus(baseXp, subscriptionStatus);
    const crowns = this.lessonCrowns(p, lesson.id, answers, subscriptionStatus);
    const updated = withSessionExtras(p, addDailyXp(updateStreak(p), xpEarned), "lesson");
    return {
      ...updated,
      coins: (updated.coins ?? 0) + crowns,
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
          heartsLost,
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

  /** Crowns a lesson completion earns, mirroring the server (shared/economy). */
  lessonCrowns(progress: Progress, lessonId: string, answers: AnswerRecord[], subscriptionStatus?: SubscriptionStatus): number {
    return lessonCrowns({
      firstTime: !progress.completedLessons.includes(lessonId),
      perfect: isPerfectRun(answers),
      newDay: !isToday(progress.lastPracticeDate),
      status: subscriptionStatus,
    });
  },

  /** The streak as it stands today (0 once a day was missed). */
  liveStreak(progress: Progress): number {
    return liveStreak(progress.streakDays, progress.lastPracticeDate ? dateDay(progress.lastPracticeDate) : null, todayKey());
  },

  /** Spends crowns on a shop item; returns null when it cannot be bought. */
  buy(progress: Progress, item: string): Progress | null {
    const price = itemPrice(item, this.liveStreak(progress));
    if (price === null || (progress.coins ?? 0) < price) return null;
    const owned = progress.ownedItems ?? [];
    if (item === "freeze") {
      if (progress.streakFreezeCount >= MAX_FREEZES) return null;
      return { ...progress, coins: progress.coins - price, streakFreezeCount: progress.streakFreezeCount + 1, updatedAt: new Date().toISOString() };
    }
    const id = item.slice("frame:".length);
    if (owned.includes(id)) return null;
    return { ...progress, coins: progress.coins - price, ownedItems: [...owned, id], updatedAt: new Date().toISOString() };
  },

  /** Opens today's chest when its three tasks are done; null otherwise. */
  claimChest(progress: Progress): { progress: Progress; crowns: number } | null {
    const today = todayKey();
    const daily = dailyFor(progress.daily, today);
    if (!chestReady(daily, progress.xpDailyHistory?.[today] ?? 0)) return null;
    const crowns = chestReward(progress.userId, today);
    return { crowns, progress: { ...progress, coins: (progress.coins ?? 0) + crowns, daily: { ...daily, claimed: true }, updatedAt: new Date().toISOString() } };
  },

  practiceDone(progress: Progress, subscriptionStatus?: SubscriptionStatus): Progress {
    const xpEarned = xpWithBonus(5, subscriptionStatus);
    const p = resetWeeklyIfNeeded(progress);
    const crowns = practiceCrowns({ newDay: !isToday(p.lastPracticeDate), status: subscriptionStatus });
    const updated = withSessionExtras(p, addDailyXp(updateStreak(p), xpEarned), "practice");
    return {
      ...updated,
      coins: (updated.coins ?? 0) + crowns,
      xpTotal: updated.xpTotal + xpEarned,
      xpWeekly: updated.xpWeekly + xpEarned,
      hearts: Math.min(updated.maxHearts, updated.hearts + 1),
      lastPracticeDate: todayKey(),
      updatedAt: new Date().toISOString()
    };
  }
};
