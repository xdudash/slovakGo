import { shiftLearningDay } from "../../shared/learningCalendar";
import { LEAGUE_REWARDS } from "../../shared/economy";
import { currentWeekId, ensureCol, exec, getDb, nowIso, query, queryOne, safeJson } from "./core";

export interface LeagueReward { weekId: string; rank: number; crowns: number }

const settled = new Set<string>();

/**
 * Pays crowns to places 1–3 of the week that just ended, exactly once.
 *
 * A learner's weekly XP is overwritten by their first lesson or practice of a new
 * week, so this runs before every such write (and on pull/leaderboard): the first
 * request of the week settles the previous one while its numbers are still there.
 */
export async function settleLeague(now = new Date()): Promise<void> {
  const week = shiftLearningDay(currentWeekId(now), -7);
  if (settled.has(week)) return;
  await exec(
    `CREATE TABLE IF NOT EXISTS league_rewards (
       week_id TEXT PRIMARY KEY, settled_at TEXT NOT NULL, winners_j TEXT NOT NULL DEFAULT '[]')`
  );
  await ensureCol("progress", "league_j", "TEXT NOT NULL DEFAULT '[]'");
  await ensureCol("progress", "owned_j", "TEXT NOT NULL DEFAULT '[]'");
  const claim = await getDb().execute({
    sql: "INSERT OR IGNORE INTO league_rewards (week_id, settled_at) VALUES (?, ?)",
    args: [week, nowIso()],
  });
  settled.add(week);
  if (!claim.rowsAffected) return;

  const top = await query(
    `SELECT p.user_id FROM progress p JOIN users u ON u.id = p.user_id
      WHERE p.week_id = ? AND p.xp_weekly > 0 AND u.role = 'student' AND u.is_blocked = 0
      ORDER BY p.xp_weekly DESC, u.id ASC LIMIT ?`,
    [week, LEAGUE_REWARDS.length]
  );
  const winners: Array<LeagueReward & { userId: string }> = [];
  for (const [index, row] of top.entries()) {
    const userId = String(row.user_id);
    const reward: LeagueReward = { weekId: week, rank: index + 1, crowns: LEAGUE_REWARDS[index] };
    const prog = await queryOne("SELECT league_j FROM progress WHERE user_id = ?", [userId]);
    const history = [...safeJson<LeagueReward[]>(String(prog?.league_j ?? "[]"), []), reward].slice(-5);
    await exec("UPDATE progress SET coins = coins + ?, league_j = ?, updated_at = ? WHERE user_id = ?",
      [reward.crowns, JSON.stringify(history), nowIso(), userId]);
    winners.push({ ...reward, userId });
  }
  await exec("UPDATE league_rewards SET winners_j = ? WHERE week_id = ?", [JSON.stringify(winners), week]);
}
