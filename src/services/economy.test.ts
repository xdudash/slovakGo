import { describe, expect, it } from "vitest";
import { canWearFrame, chestReady, chestReward, dailyFor, isPerfectRun, itemPrice, lessonCrowns, liveStreak, practiceCrowns, streakMilestone } from "../../shared/economy";
import { reminderCopy } from "../../api/cron/reminders";
import { progressService } from "./progressService";
import type { Progress } from "../types";

describe("crowns economy", () => {
  it("rewards new, perfect and first-of-day lessons", () => {
    expect(lessonCrowns({ firstTime: true, perfect: false, newDay: false })).toBe(10);
    expect(lessonCrowns({ firstTime: true, perfect: true, newDay: true })).toBe(25);
    expect(lessonCrowns({ firstTime: false, perfect: true, newDay: false })).toBe(2);
    expect(lessonCrowns({ firstTime: true, perfect: true, newDay: true, status: "trial" })).toBe(38);
    expect(practiceCrowns({ newDay: true })).toBe(8);
  });

  it("treats only an all-correct run as perfect", () => {
    expect(isPerfectRun([])).toBe(false);
    expect(isPerfectRun([{ correct: true }, { correct: true }])).toBe(true);
    expect(isPerfectRun([{ correct: true }, { correct: false }])).toBe(false);
  });

  it("prices only purchasable items", () => {
    expect(itemPrice("freeze")).toBe(50);
    expect(itemPrice("frame:lime")).toBe(60);
    expect(itemPrice("frame:simple")).toBeNull();
    expect(itemPrice("frame:fire")).toBeNull();
    expect(itemPrice("hearts")).toBeNull();
  });

  it("lets Plus wear the fire frame and others wear what they own", () => {
    expect(canWearFrame("fire", [], "free")).toBe(false);
    expect(canWearFrame("fire", [], "plus")).toBe(true);
    expect(canWearFrame("gold", [], "plus")).toBe(false);
    expect(canWearFrame("gold", ["gold"], "free")).toBe(true);
    expect(canWearFrame("simple", [], "free")).toBe(true);
  });

  it("pays streak milestones only when the streak reaches them", () => {
    expect(streakMilestone(2, 3)).toEqual({ days: 3, crowns: 20 });
    expect(streakMilestone(6, 7)).toEqual({ days: 7, crowns: 50 });
    expect(streakMilestone(7, 7)).toBeNull();
    expect(streakMilestone(5, 1)).toBeNull();
  });

  it("discounts the shop for a streak that is still alive", () => {
    expect(itemPrice("frame:violet", 2)).toBe(150);
    expect(itemPrice("frame:violet", 3)).toBe(135);
    expect(itemPrice("freeze", 7)).toBe(40);
    expect(liveStreak(9, "2026-11-25", "2026-11-26")).toBe(9);
    expect(liveStreak(9, "2026-11-24", "2026-11-26")).toBe(0);
    expect(itemPrice("frame:comet", 30)).toBeNull();
  });

  it("opens the daily chest once, after a lesson, a practice and 30 XP", () => {
    const today = "2026-11-26";
    expect(chestReady(dailyFor({ day: today, lessons: 1, practices: 1, claimed: false }, today), 30)).toBe(true);
    expect(chestReady(dailyFor({ day: today, lessons: 1, practices: 0, claimed: false }, today), 90)).toBe(false);
    expect(chestReady(dailyFor({ day: "2026-11-25", lessons: 3, practices: 3, claimed: false }, today), 90)).toBe(false);
    expect(chestReady(dailyFor({ day: today, lessons: 1, practices: 1, claimed: true }, today), 90)).toBe(false);
    const reward = chestReward("user-1", today);
    expect(reward).toBeGreaterThanOrEqual(20);
    expect(reward).toBeLessThanOrEqual(40);
    expect(chestReward("user-1", today)).toBe(reward);
  });

  it("mirrors the chest in the app and refuses a second claim", () => {
    const now = new Date();
    const today = now.toLocaleDateString("en-CA", { timeZone: "Europe/Bratislava" });
    const progress = { userId: "u", coins: 0, daily: { day: today, lessons: 1, practices: 1, claimed: false }, xpDailyHistory: { [today]: 40 } } as unknown as Progress;
    const first = progressService.claimChest(progress)!;
    expect(first.progress.coins).toBe(first.crowns);
    expect(progressService.claimChest(first.progress)).toBeNull();
  });

  it("writes web reminders that name a streak ending tonight", () => {
    expect(reminderCopy(4, "2026-11-25", "2026-11-26").title).toContain("4");
    expect(reminderCopy(4, "2026-11-20", "2026-11-26").body).toContain("Скриня");
  });
});
