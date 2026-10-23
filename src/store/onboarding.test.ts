import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedData } from "../data/seedData";

vi.hoisted(() => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined });
});
vi.mock("../services/storage", async () => {
  const { seedData: initial } = await import("../data/seedData");
  return { storageService: { load: () => structuredClone(initial), save: () => undefined } };
});
vi.mock("../services/idbQueue", () => ({ idbPut: async () => undefined }));

import { useAppStore } from "./useAppStore";

describe("onboarding starting level", () => {
  beforeEach(() => {
    const data = structuredClone(seedData);
    const user = data.users.find((value) => value.id === "user-student")!;
    user.onboardingDone = false;
    user.level = "A0";
    data.progress[user.id] = { ...data.progress[user.id], currentLevel: "A0", freePreviewLevel: "A0", completedLessons: [] };
    useAppStore.setState({ data, currentUserId: user.id, drainSync: vi.fn().mockResolvedValue(undefined), refreshUser: vi.fn().mockResolvedValue(undefined) });
  });

  it("opens the chosen level immediately instead of retaining the A0 preview", () => {
    useAppStore.getState().completeOnboarding("Work", "B1");
    const { data } = useAppStore.getState();
    const progress = data.progress["user-student"];
    expect(progress).toMatchObject({ currentLevel: "B1", freePreviewLevel: "B1" });
    expect(data.lessons.find((lesson) => lesson.id === progress.currentLessonId)?.level).toBe("B1");
    expect(data.syncQueue.at(-1)?.payload).toMatchObject({ level: "B1", goal: "Work", onboardingDone: true });
  });

  it("does not reset an existing account’s free allowance when onboarding is replayed", () => {
    const data = useAppStore.getState().data;
    data.users.find((value) => value.id === "user-student")!.onboardingDone = true;
    useAppStore.getState().completeOnboarding("Work", "B1");
    expect(useAppStore.getState().data.progress["user-student"].freePreviewLevel).toBe("A0");
  });
});
