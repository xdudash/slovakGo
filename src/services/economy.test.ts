import { describe, expect, it } from "vitest";
import { canWearFrame, isPerfectRun, itemPrice, lessonCrowns, practiceCrowns } from "../../shared/economy";

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
});
