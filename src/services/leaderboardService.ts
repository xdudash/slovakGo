import type { Leaderboard, Progress, User } from "../types";
import { secondsUntilWeekEnd } from "../utils/date";

export const leaderboardService = {
  recalculate(leaderboard: Leaderboard, users: User[], progress: Record<string, Progress>): Leaderboard {
    const seeded = leaderboard.entries.filter((entry) => !users.some((user) => user.id === entry.userId));
    const real = users
      .filter((user) => user.role === "student")
      .map((user) => ({
        userId: user.id,
        name: user.name,
        avatar: user.avatar,
        xpWeekly: progress[user.id]?.xpWeekly || 0,
        rank: 0,
        movement: "same" as const
      }));
    const entries = [...seeded, ...real]
      .sort((a, b) => b.xpWeekly - a.xpWeekly)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
    return { ...leaderboard, entries };
  },

  timerSeconds(): number {
    return secondsUntilWeekEnd();
  }
};
