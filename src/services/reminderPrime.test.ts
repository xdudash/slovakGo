import { beforeEach, describe, expect, it, vi } from "vitest";
import { markReminderPrime, shouldPrimeReminders } from "./reminderPrime";

describe("reminder primer schedule", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
    });
  });

  it("asks after the first lesson, then once more after lesson 3 if postponed", () => {
    expect(shouldPrimeReminders("u", 0)).toBe(false);
    expect(shouldPrimeReminders("u", 1)).toBe(true);
    markReminderPrime("u", "dismissed");
    expect(shouldPrimeReminders("u", 2)).toBe(false);
    expect(shouldPrimeReminders("u", 3)).toBe(true);
    markReminderPrime("u", "done");
    expect(shouldPrimeReminders("u", 9)).toBe(false);
  });
});
