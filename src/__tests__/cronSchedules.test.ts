/**
 * Unit tests for the two cron recipient filters.
 *
 * These decide who gets a push / an email, and they used to be inline in the
 * handlers — where a mismatch between the cron schedule and the hour-matching
 * logic silently reduced reminder delivery to almost nobody.
 */
import { describe, it, expect } from "vitest";
import { shouldRemind } from "../../api/cron/reminders";
import { pickEmail } from "../../api/cron/lifecycle";

describe("shouldRemind", () => {
  it("skips users who turned notifications off, in both modes", () => {
    const off = { notificationsEnabled: false, reminderTime: "19:00" };
    expect(shouldRemind(off, 19, true)).toBe(false);
    expect(shouldRemind(off, 19, false)).toBe(false);
  });

  it("matches the user's own hour in hourly mode", () => {
    const s = { notificationsEnabled: true, reminderTime: "19:00" };
    expect(shouldRemind(s, 19, true)).toBe(true);
    expect(shouldRemind(s, 18, true)).toBe(false);
  });

  it("skips users without a reminder time in hourly mode", () => {
    expect(shouldRemind({ notificationsEnabled: true }, 19, true)).toBe(false);
  });

  it("reminds everyone in daily mode, including users without a reminder time", () => {
    expect(shouldRemind({ notificationsEnabled: true }, 17, false)).toBe(true);
    expect(shouldRemind({ notificationsEnabled: true, reminderTime: "08:00" }, 17, false)).toBe(true);
  });

  it("ignores a malformed reminder time instead of matching NaN", () => {
    expect(shouldRemind({ notificationsEnabled: true, reminderTime: "later" }, 19, true)).toBe(false);
  });
});

describe("pickEmail", () => {
  const base = {
    id: "u1",
    email: "a@b.c",
    name: "Оля",
    daysSinceSignup: 0,
    inactiveDays: 0,
    completedLessons: 0,
    streakDays: 0,
    xpTotal: 0,
  };
  const none = new Set<never>();

  it("welcomes on signup day", () => {
    expect(pickEmail(base, none)).toBe("d0_welcome");
  });

  it("nudges on day 1 when no lesson is finished", () => {
    expect(pickEmail({ ...base, daysSinceSignup: 1, inactiveDays: 1 }, new Set(["d0_welcome"]))).toBe("d1_first");
  });

  it("does not nudge on day 1 when a lesson is already finished", () => {
    const c = { ...base, daysSinceSignup: 1, inactiveDays: 0, completedLessons: 2 };
    expect(pickEmail(c, new Set(["d0_welcome"]))).toBeNull();
  });

  it("re-engages after three inactive days", () => {
    const c = { ...base, daysSinceSignup: 4, inactiveDays: 3, completedLessons: 1 };
    expect(pickEmail(c, new Set(["d0_welcome"]))).toBe("d3_inactive");
  });

  it("sends the week summary only to learners who practised", () => {
    const active = { ...base, daysSinceSignup: 7, inactiveDays: 0, completedLessons: 5, xpTotal: 120 };
    const already = new Set(["d0_welcome", "d1_first", "d3_inactive"] as const);
    expect(pickEmail(active, new Set(already))).toBe("d7_progress");
    // A learner who never finished a lesson gets nothing here — they already had
    // the d1 nudge, and a "your week" summary with zeroes would be insulting.
    expect(pickEmail({ ...active, completedLessons: 0 }, new Set(already))).toBeNull();
  });

  it("never repeats a kind that was already sent", () => {
    const all = new Set(["d0_welcome", "d1_first", "d3_inactive", "d7_progress"] as const);
    const c = { ...base, daysSinceSignup: 8, inactiveDays: 8, completedLessons: 3 };
    expect(pickEmail(c, new Set(all))).toBeNull();
  });
});
