import { describe, expect, it } from "vitest";
import { accessService } from "./accessService";
import type { Lesson, Progress } from "../types";

const lesson = (id: string, level: Lesson["level"], topic: string, order: number): Lesson => ({
  id, level, topic, order, title: id, description: "", xpReward: 10, estimatedMinutes: 5,
  isPublished: true, isLocked: false, words: [], exercises: [], updatedAt: "2026-01-01T00:00:00Z"
});

const lessons = [
  lesson("a0-1", "A0", "Перший розділ", 1),
  lesson("a0-2", "A0", "Перший розділ", 2),
  lesson("a0-3", "A0", "Другий розділ", 3),
  lesson("b1-1", "B1", "Старт B1", 1)
];

const progress = (completedLessons: string[], currentLevel: Progress["currentLevel"] = "A0"): Progress => ({
  userId: "u1", currentLevel, currentLessonId: "a0-1", completedLessons, lessonAttempts: [],
  xpTotal: 0, xpWeekly: 0, hearts: 5, maxHearts: 5, streakDays: 0,
  streakFreezeCount: 0, coins: 0, mistakes: [], achievements: [], updatedAt: "2026-01-01T00:00:00Z"
});

describe("preview access", () => {
  it("allows only lessons from the first section before trial", () => {
    expect(accessService.canOpenLesson("a0-1", lessons, progress([]), "free")).toBe(true);
    expect(accessService.canOpenLesson("a0-3", lessons, progress([]), "free")).toBe(false);
  });

  it("locks learning after the first section is complete", () => {
    const completed = progress(["a0-1", "a0-2"]);
    expect(accessService.hasCompletedFirstSectionAtAnyLevel(lessons, completed)).toBe(true);
    expect(accessService.canOpenLesson("a0-3", lessons, completed, "free")).toBe(false);
  });

  it("keeps completed preview lessons available for their result screen and replay", () => {
    const completed = progress(["a0-1", "a0-2"]);
    expect(accessService.canOpenLesson("a0-2", lessons, completed, "free")).toBe(true);
  });

  it("cannot be bypassed by changing the current level", () => {
    const completed = progress(["a0-1", "a0-2"], "B1");
    expect(accessService.canOpenLesson("b1-1", lessons, completed, "free")).toBe(false);
  });

  it("gives trial and plus users full access", () => {
    expect(accessService.canOpenLesson("a0-3", lessons, progress([]), "trial")).toBe(true);
    expect(accessService.canOpenLesson("a0-3", lessons, progress([]), "plus")).toBe(true);
  });

  it("does not reopen the preview after a subscription expires", () => {
    expect(accessService.canOpenLesson("a0-1", lessons, progress([]), "expired")).toBe(false);
  });

  it("keeps access open while Stripe retries a failed payment", () => {
    // past_due is a grace state — locking the user out on the first failed charge
    // loses subscriptions that Stripe's retries would have recovered.
    expect(accessService.hasFullAccess("past_due")).toBe(true);
    expect(accessService.canOpenLesson("a0-3", lessons, progress([]), "past_due")).toBe(true);
  });

  it("still locks access once Stripe gives up and cancels", () => {
    expect(accessService.hasFullAccess("cancelled")).toBe(false);
    expect(accessService.canOpenLesson("a0-3", lessons, progress([]), "cancelled")).toBe(false);
  });
});
