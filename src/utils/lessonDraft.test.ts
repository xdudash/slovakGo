import { describe, expect, it } from "vitest";
import { clearLessonDraft, LESSON_DRAFT_MAX_AGE_MS, loadLessonDraft, saveLessonDraft } from "./lessonDraft";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
  };
}

const shape = { theoryCount: 2, hasWords: true, exerciseCount: 5 };
const record = { exerciseId: "e1", answer: "a", correct: true, answeredAt: "2026-10-19T00:00:00Z" };

describe("lessonDraft", () => {
  it("resumes an exercise position with its answer records", () => {
    const s = memoryStorage();
    saveLessonDraft("u1", "l1", { phase: "exercise", theoryIndex: 0, index: 3, records: [record] }, 1000, s);
    expect(loadLessonDraft("u1", "l1", shape, 2000, s)).toEqual({ phase: "exercise", theoryIndex: 0, index: 3, records: [record], attemptsRemaining: 5, savedAt: 1000 });
  });

  it("restores lesson-local attempts, including zero, without affecting another lesson", () => {
    const s = memoryStorage();
    saveLessonDraft("u1", "l1", { phase: "exercise", theoryIndex: 0, index: 3, records: [record], attemptsRemaining: 0 }, 1000, s);
    saveLessonDraft("u1", "l2", { phase: "exercise", theoryIndex: 0, index: 0, records: [], attemptsRemaining: 5 }, 1000, s);
    expect(loadLessonDraft("u1", "l1", shape, 2000, s)?.attemptsRemaining).toBe(0);
    expect(loadLessonDraft("u1", "l1", shape, 2000, s)?.index).toBe(3);
    expect(loadLessonDraft("u1", "l2", shape, 2000, s)?.attemptsRemaining).toBe(5);
  });

  it("replaces invalid attempt counts while preserving a valid lesson position", () => {
    const s = memoryStorage();
    for (const attemptsRemaining of [-1, 6, 2.5]) {
      saveLessonDraft("u1", "l1", { phase: "exercise", theoryIndex: 0, index: 2, records: [], attemptsRemaining }, 1000, s);
      expect(loadLessonDraft("u1", "l1", shape, 2000, s)?.attemptsRemaining).toBe(5);
      expect(loadLessonDraft("u1", "l1", shape, 2000, s)?.index).toBe(2);
    }
  });

  it("keeps drafts separate per user and lesson", () => {
    const s = memoryStorage();
    saveLessonDraft("u1", "l1", { phase: "theory", theoryIndex: 1, index: 0, records: [] }, 1000, s);
    expect(loadLessonDraft("u2", "l1", shape, 1000, s)).toBeNull();
    expect(loadLessonDraft("u1", "l2", shape, 1000, s)).toBeNull();
  });

  it("drops drafts that no longer fit the lesson or are too old", () => {
    const s = memoryStorage();
    saveLessonDraft("u1", "l1", { phase: "exercise", theoryIndex: 0, index: 9, records: [] }, 1000, s);
    expect(loadLessonDraft("u1", "l1", shape, 1000, s)).toBeNull();
    expect(s.map.size).toBe(0);

    saveLessonDraft("u1", "l1", { phase: "words", theoryIndex: 0, index: 0, records: [] }, 1000, s);
    expect(loadLessonDraft("u1", "l1", { ...shape, hasWords: false }, 1000, s)).toBeNull();

    saveLessonDraft("u1", "l1", { phase: "theory", theoryIndex: 0, index: 0, records: [] }, 1000, s);
    expect(loadLessonDraft("u1", "l1", shape, 1000 + LESSON_DRAFT_MAX_AGE_MS + 1, s)).toBeNull();
  });

  it("clears a draft and tolerates corrupt or missing storage", () => {
    const s = memoryStorage();
    saveLessonDraft("u1", "l1", { phase: "exercise", theoryIndex: 0, index: 1, records: [] }, 1000, s);
    clearLessonDraft("u1", "l1", s);
    expect(loadLessonDraft("u1", "l1", shape, 1000, s)).toBeNull();
    s.map.set("slovakgo.lesson-draft:u1:l1", "{not json");
    expect(loadLessonDraft("u1", "l1", shape, 1000, s)).toBeNull();
    expect(loadLessonDraft("u1", "l1", shape, 1000, undefined)).toBeNull();
  });
});
