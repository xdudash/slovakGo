import { describe, expect, it } from 'vitest';
import { progressService } from './progressService';
import { currentWeekId } from '../utils/date';
import type { Lesson, Progress } from '../types';

const THIS_WEEK = currentWeekId();
const OLD_WEEK = '2000-01-03'; // Monday far in the past — always != THIS_WEEK

const BASE_LESSON: Lesson = {
  id: 'lesson-test',
  level: 'A1',
  title: 'Test lesson',
  description: '',
  topic: 'Test',
  order: 1,
  xpReward: 12,
  estimatedMinutes: 5,
  isPublished: true,
  words: [],
  exercises: [],
  updatedAt: '2026-01-01T00:00:00Z',
};

function makeProgress(overrides: Partial<Progress> = {}): Progress {
  return {
    userId: 'user-test',
    currentLevel: 'A1',
    completedLessons: [],
    lessonAttempts: [],
    xpTotal: 100,
    xpWeekly: 80,
    weekId: THIS_WEEK,
    hearts: 5,
    maxHearts: 5,
    streakDays: 3,
    lastPracticeDate: new Date().toISOString(), // today → updateStreak no-ops
    streakFreezeCount: 0,
    coins: 0,
    mistakes: [],
    achievements: [],
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Progress;
}

// ─── Weekly XP reset ──────────────────────────────────────────────────────────

describe('weekly XP reset', () => {
  it('resets xpWeekly to 0 and then adds XP when week has changed', () => {
    const p = makeProgress({ weekId: OLD_WEEK, xpWeekly: 999 });
    const result = progressService.completeLesson(p, BASE_LESSON, []);
    expect(result.xpWeekly).toBe(BASE_LESSON.xpReward); // 0 + 12
  });

  it('does NOT reset xpWeekly within the same week', () => {
    const p = makeProgress({ weekId: THIS_WEEK, xpWeekly: 80 });
    const result = progressService.completeLesson(p, BASE_LESSON, []);
    expect(result.xpWeekly).toBe(80 + BASE_LESSON.xpReward); // 92
  });

  it('sets weekId without resetting when weekId is undefined (first run)', () => {
    const p = makeProgress({ weekId: undefined, xpWeekly: 50 });
    const result = progressService.completeLesson(p, BASE_LESSON, []);
    expect(result.weekId).toBe(THIS_WEEK);
    expect(result.xpWeekly).toBe(50 + BASE_LESSON.xpReward); // no reset
  });

  it('practiceDone: resets xpWeekly when week changes', () => {
    const p = makeProgress({ weekId: OLD_WEEK, xpWeekly: 200 });
    const result = progressService.practiceDone(p);
    expect(result.xpWeekly).toBe(5); // reset to 0 + practice bonus
  });

  it('practiceDone: accumulates within same week', () => {
    const p = makeProgress({ weekId: THIS_WEEK, xpWeekly: 20 });
    const result = progressService.practiceDone(p);
    expect(result.xpWeekly).toBe(25);
  });
});

// ─── xpTotal always accumulates ───────────────────────────────────────────────

describe('xpTotal', () => {
  it('always adds xpReward to xpTotal even after weekly reset', () => {
    const p = makeProgress({ weekId: OLD_WEEK, xpTotal: 500, xpWeekly: 999 });
    const result = progressService.completeLesson(p, BASE_LESSON, []);
    expect(result.xpTotal).toBe(500 + BASE_LESSON.xpReward);
    expect(result.xpWeekly).toBe(BASE_LESSON.xpReward); // reset
  });
});

// ─── Repeat lesson earns less XP ──────────────────────────────────────────────

describe('completeLesson XP reward', () => {
  it('awards full xpReward on first completion', () => {
    const p = makeProgress({ completedLessons: [] });
    const result = progressService.completeLesson(p, BASE_LESSON, []);
    expect(result.xpWeekly).toBe(80 + 12);
  });

  it('awards 25% (min 3) xpReward on repeat completion', () => {
    const p = makeProgress({ completedLessons: [BASE_LESSON.id] });
    const result = progressService.completeLesson(p, BASE_LESSON, []);
    const expected = Math.max(3, Math.round(12 * 0.25)); // 3
    expect(result.xpWeekly).toBe(80 + expected);
  });

  it('records the lesson as completed on first try', () => {
    const p = makeProgress({ completedLessons: [] });
    const result = progressService.completeLesson(p, BASE_LESSON, []);
    expect(result.completedLessons).toContain(BASE_LESSON.id);
  });

  it('does not duplicate completedLessons on repeat', () => {
    const p = makeProgress({ completedLessons: [BASE_LESSON.id] });
    const result = progressService.completeLesson(p, BASE_LESSON, []);
    expect(result.completedLessons.filter((id) => id === BASE_LESSON.id)).toHaveLength(1);
  });
});

// ─── answer scoring ───────────────────────────────────────────────────────────

describe('progressService.check', () => {
  const ex = {
    id: 'ex-1',
    lessonId: BASE_LESSON.id,
    type: 'multiple_choice_translation' as const,
    question: 'Q',
    correctAnswer: 'ahoj',
    order: 1,
  };

  it('matches exact answer', () => {
    expect(progressService.check(ex, 'ahoj')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(progressService.check(ex, 'AHOJ')).toBe(true);
  });

  it('trims whitespace', () => {
    expect(progressService.check(ex, '  ahoj  ')).toBe(true);
  });

  it('rejects wrong answer', () => {
    expect(progressService.check(ex, 'čau')).toBe(false);
  });
});
