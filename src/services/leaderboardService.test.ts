import { describe, expect, it } from 'vitest';
import { leaderboardService } from './leaderboardService';
import type { Leaderboard, Progress, User } from '../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeLeaderboard(overrides: Partial<Leaderboard> = {}): Leaderboard {
  return {
    weekId: '2026-06-01',
    league: 'Bronze',
    entries: [
      { userId: 'npc-1', name: 'Марія',    xpWeekly: 300, rank: 1, movement: 'up' },
      { userId: 'npc-2', name: 'Андрій',   xpWeekly: 200, rank: 2, movement: 'same' },
      { userId: 'user-real', name: 'Олена', xpWeekly: 50, rank: 3, movement: 'same' },
    ],
    ...overrides,
  };
}

function makeUser(id: string, role: User['role'] = 'student'): User {
  return {
    id,
    name: id,
    email: `${id}@test.com`,
    role,
    level: 'A1',
    createdAt: '',
    subscriptionStatus: 'trial',
    onboardingDone: true,
    settings: { language: 'uk', notificationsEnabled: false, soundEnabled: false, hapticsEnabled: false },
  };
}

function makeProgressMap(...entries: [string, number][]): Record<string, Progress> {
  return Object.fromEntries(
    entries.map(([userId, xpWeekly]) => [
      userId,
      {
        userId,
        currentLevel: 'A1' as const,
        completedLessons: [],
        lessonAttempts: [],
        xpTotal: xpWeekly,
        xpWeekly,
        hearts: 5,
        maxHearts: 5,
        streakDays: 0,
        streakFreezeCount: 0,
        coins: 0,
        mistakes: [],
        achievements: [],
        updatedAt: '',
      } satisfies Progress,
    ])
  );
}

// ─── recalculate ──────────────────────────────────────────────────────────────

describe('leaderboardService.recalculate', () => {
  it('preserves NPC entries that have no matching user', () => {
    const lb = makeLeaderboard();
    const users = [makeUser('user-real')];
    const progress = makeProgressMap(['user-real', 50]);
    const result = leaderboardService.recalculate(lb, users, progress);
    expect(result.entries.some((e) => e.userId === 'npc-1')).toBe(true);
    expect(result.entries.some((e) => e.userId === 'npc-2')).toBe(true);
  });

  it('replaces real-user seed entry with fresh progress XP', () => {
    const lb = makeLeaderboard(); // user-real seed: 50 XP
    const users = [makeUser('user-real')];
    const progress = makeProgressMap(['user-real', 175]); // actually earned more
    const result = leaderboardService.recalculate(lb, users, progress);
    const entry = result.entries.find((e) => e.userId === 'user-real');
    expect(entry?.xpWeekly).toBe(175);
  });

  it('sorts entries by xpWeekly descending', () => {
    const lb = makeLeaderboard();
    const users = [makeUser('user-real')];
    const progress = makeProgressMap(['user-real', 999]); // beats all NPCs
    const result = leaderboardService.recalculate(lb, users, progress);
    expect(result.entries[0].userId).toBe('user-real');
  });

  it('assigns sequential ranks starting from 1', () => {
    const lb = makeLeaderboard();
    const users = [makeUser('user-real')];
    const progress = makeProgressMap(['user-real', 50]);
    const result = leaderboardService.recalculate(lb, users, progress);
    result.entries.forEach((entry, i) => {
      expect(entry.rank).toBe(i + 1);
    });
  });

  it('excludes teachers from leaderboard', () => {
    const lb = makeLeaderboard();
    const users = [makeUser('user-real'), makeUser('user-teacher', 'teacher')];
    const progress = makeProgressMap(['user-real', 50], ['user-teacher', 9999]);
    const result = leaderboardService.recalculate(lb, users, progress);
    expect(result.entries.some((e) => e.userId === 'user-teacher')).toBe(false);
  });

  it('excludes admins from leaderboard', () => {
    const lb = makeLeaderboard();
    const users = [makeUser('user-real'), makeUser('user-admin', 'admin')];
    const progress = makeProgressMap(['user-real', 50], ['user-admin', 9999]);
    const result = leaderboardService.recalculate(lb, users, progress);
    expect(result.entries.some((e) => e.userId === 'user-admin')).toBe(false);
  });

  it('assigns 0 xpWeekly to student with no progress record', () => {
    const lb = makeLeaderboard();
    const users = [makeUser('user-new')];
    const result = leaderboardService.recalculate(lb, users, {});
    const entry = result.entries.find((e) => e.userId === 'user-new');
    expect(entry?.xpWeekly).toBe(0);
  });

  it('preserves other leaderboard fields (league, weekId)', () => {
    const lb = makeLeaderboard({ league: 'Gold', weekId: '2026-06-01' });
    const result = leaderboardService.recalculate(lb, [], {});
    expect(result.league).toBe('Gold');
    expect(result.weekId).toBe('2026-06-01');
  });
});
