import { describe, expect, it } from "vitest";
import { accessService } from "./accessService";
import type { Lesson, Progress } from "../types";
const lesson = (id: string, level: Lesson["level"], topic: string, order: number): Lesson => ({
  id, level, topic, order, title: id, description: "", xpReward: 10, estimatedMinutes: 5,
  isPublished: true, isLocked: false, words: [], exercises: [], updatedAt: "2026-01-01T00:00:00Z"
});
const lessons = [...Array.from({ length: 11 }, (_, i) => lesson(`a0-${i+1}`, "A0", `Topic ${i}`, i+1)), lesson("b1-1", "B1", "B1", 1)];
const completed = lessons.slice(0, 10).map(l => l.id);
const progress = (ids: string[] = [], currentLevel: Progress["currentLevel"] = "A0"): Progress => ({
  userId: "u1", currentLevel, freePreviewLevel: "A0", completedLessons: ids, lessonAttempts: [],
  xpTotal: 0, xpWeekly: 0, hearts: 5, maxHearts: 5, streakDays: 0,
  streakFreezeCount: 0, coins: 0, mistakes: [], achievements: [], updatedAt: "2026-01-01T00:00:00Z"
});
describe("ten free lessons", () => {
  it("crosses topic boundaries, including topics with only one lesson", () => {
    expect(accessService.hasCompletedPreviewAtAnyLevel(lessons, progress(["a0-1"]))).toBe(false);
    expect(accessService.canOpenLesson("a0-2", lessons, progress(["a0-1"]), "free")).toBe(true);
    expect(accessService.canOpenLesson("a0-10", lessons, progress(), "free")).toBe(true);
    expect(accessService.canOpenLesson("a0-11", lessons, progress(), "free")).toBe(false);
  });
  it("offers trial exactly after ten distinct completions", () => {
    expect(accessService.isFinalPreviewLesson("a0-10", lessons, progress(completed.slice(0,9)), "free")).toBe(true);
    expect(accessService.canUsePreview(lessons, progress(completed.slice(0,9)), "free")).toBe(true);
    expect(accessService.canUsePreview(lessons, progress(completed), "free")).toBe(false);
    expect(accessService.canUsePreview(lessons, progress(Array(10).fill("a0-1")), "free")).toBe(true);
  });
  it("allows replay without opening an eleventh lesson", () => {
    expect(accessService.canOpenLesson("a0-10", lessons, progress(completed), "free")).toBe(true);
    expect(accessService.canOpenLesson("a0-11", lessons, progress(completed), "free")).toBe(false);
  });
  it("changing the level does not grant another free catalog", () => {
    expect(accessService.canOpenLesson("b1-1", lessons, progress([], "B1"), "free")).toBe(false);
    expect(accessService.canUsePreview(lessons, progress(completed, "B1"), "free")).toBe(false);
  });
  it("does not end preview when a level contains fewer than ten lessons", () => {
    const few = lessons.slice(0,2);
    expect(accessService.canUsePreview(few, progress(few.map(l => l.id)), "free")).toBe(true);
  });
  it("continues the ten-lesson catalog into the next level when the starting level is short", () => {
    const short = [...lessons.slice(0,2), lesson("a1-1", "A1", "Next level", 1)];
    expect(accessService.firstPreviewLessons(short, "A0").map(l => l.id)).toEqual(["a0-1", "a0-2", "a1-1"]);
    expect(accessService.canOpenLesson("a1-1", short, progress(["a0-1", "a0-2"], "A1"), "free")).toBe(true);
  });
  it("grants paid/trial/grace access and locks expired/cancelled access", () => {
    for (const status of ["trial", "plus", "past_due"] as const) expect(accessService.canOpenLesson("a0-11", lessons, progress(), status)).toBe(true);
    for (const status of ["expired", "cancelled"] as const) expect(accessService.canOpenLesson("a0-1", lessons, progress(), status)).toBe(false);
  });
});
