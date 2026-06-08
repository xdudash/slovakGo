import type { Leaderboard, LeaderboardEntry, Progress, User } from "../types";
import { currentWeekId, secondsUntilWeekEnd } from "../utils/date";

const LEAGUE_ORDER: Leaderboard["league"][] = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
const LEAGUE_THRESHOLDS: Record<Leaderboard["league"], number> = {
  Bronze: 0, Silver: 300, Gold: 600, Platinum: 1000, Diamond: 1500,
};

// Top/bottom N% of entries get promoted/demoted at week end
const LEAGUE_CHANGE_PCT = 0.1;

export const leaderboardService = {
  recalculate(leaderboard: Leaderboard, users: User[], progress: Record<string, Progress>): Leaderboard {
    const currentWeek = currentWeekId();
    let history = leaderboard.history ?? [];

    // Week transition: snapshot current week before resetting
    if (leaderboard.weekId && leaderboard.weekId !== currentWeek && leaderboard.entries.length > 0) {
      history = [...history, { weekId: leaderboard.weekId, entries: leaderboard.entries }].slice(-8);
    }

    // Build previous-rank map: use last week's snapshot, fall back to current entries
    const prevEntries = history.length > 0 ? history[history.length - 1].entries : leaderboard.entries;
    const prevRankMap = new Map(prevEntries.map((e) => [e.userId, e.rank]));

    // NPC entries (not matched to real users)
    const seeded = leaderboard.entries.filter((e) => !users.some((u) => u.id === e.userId));

    // Randomize NPC xpWeekly on week transition so they feel alive
    const seededCurrent = (leaderboard.weekId !== currentWeek)
      ? seeded.map((e) => ({ ...e, xpWeekly: Math.floor(Math.random() * 320) + 30 }))
      : seeded;

    // Real student entries
    const real: LeaderboardEntry[] = users
      .filter((u) => u.role === "student")
      .map((u) => ({
        userId: u.id,
        name: u.name,
        avatar: u.avatar,
        country: u.country,
        xpWeekly: progress[u.id]?.xpWeekly ?? 0,
        rank: 0,
        movement: "same" as const,
      }));

    // Sort descending by XP
    const sorted = [...seededCurrent, ...real].sort((a, b) => b.xpWeekly - a.xpWeekly);
    const total = sorted.length;
    const promoteCount = Math.max(1, Math.ceil(total * LEAGUE_CHANGE_PCT));
    const demoteCount = Math.max(1, Math.ceil(total * LEAGUE_CHANGE_PCT));

    const entries: LeaderboardEntry[] = sorted.map((entry, idx) => {
      const rank = idx + 1;
      const prevRank = prevRankMap.get(entry.userId);
      const movement: LeaderboardEntry["movement"] =
        prevRank == null ? "same"
        : rank < prevRank ? "up"
        : rank > prevRank ? "down"
        : "same";
      const leagueChange: LeaderboardEntry["leagueChange"] =
        idx < promoteCount ? "promoted"
        : idx >= total - demoteCount ? "demoted"
        : undefined;
      return { ...entry, rank, movement, leagueChange };
    });

    return { ...leaderboard, weekId: currentWeek, entries, history };
  },

  timerSeconds(): number {
    return secondsUntilWeekEnd();
  },

  leagueFor(xpWeekly: number): Leaderboard["league"] {
    let result: Leaderboard["league"] = "Bronze";
    for (const tier of LEAGUE_ORDER) {
      if (xpWeekly >= LEAGUE_THRESHOLDS[tier]) result = tier;
    }
    return result;
  },

  xpToNextLeague(xpWeekly: number): number | null {
    const current = this.leagueFor(xpWeekly);
    const idx = LEAGUE_ORDER.indexOf(current);
    if (idx === LEAGUE_ORDER.length - 1) return null;
    return LEAGUE_THRESHOLDS[LEAGUE_ORDER[idx + 1]] - xpWeekly;
  },

  progressInLeague(xpWeekly: number): number {
    const current = this.leagueFor(xpWeekly);
    const idx = LEAGUE_ORDER.indexOf(current);
    if (idx === LEAGUE_ORDER.length - 1) return 100;
    const low = LEAGUE_THRESHOLDS[current];
    const high = LEAGUE_THRESHOLDS[LEAGUE_ORDER[idx + 1]];
    return Math.min(100, Math.round(((xpWeekly - low) / (high - low)) * 100));
  },
};
