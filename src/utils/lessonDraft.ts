import type { AnswerRecord } from "../types";

/**
 * Mid-lesson position, kept per user and lesson so a learner who leaves a
 * lesson on their phone (incoming call, app switch, reload) resumes where they
 * stopped instead of restarting from the first screen.
 */
export type LessonDraftPhase = "theory" | "words" | "exercise";
export const LESSON_ATTEMPTS = 5;

export interface LessonDraft {
  phase: LessonDraftPhase;
  theoryIndex: number;
  index: number;
  records: AnswerRecord[];
  attemptsRemaining?: number;
  savedAt: number;
}

export interface LessonShape {
  theoryCount: number;
  hasWords: boolean;
  exerciseCount: number;
}

type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const PREFIX = "slovakgo.lesson-draft";
export const LESSON_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function defaultStorage(): KV | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

function key(userId: string, lessonId: string): string {
  return `${PREFIX}:${userId}:${lessonId}`;
}

function isIndex(value: unknown, upperExclusive: number): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < upperExclusive;
}

/** Returns a draft only if it still fits the lesson's current structure. */
export function loadLessonDraft(
  userId: string | undefined,
  lessonId: string | undefined,
  shape: LessonShape,
  now = Date.now(),
  storage: KV | undefined = defaultStorage(),
): LessonDraft | null {
  if (!userId || !lessonId || !storage) return null;
  try {
    const raw = storage.getItem(key(userId, lessonId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<LessonDraft>;
    const fresh = typeof draft.savedAt === "number" && now - draft.savedAt <= LESSON_DRAFT_MAX_AGE_MS;
    const records = Array.isArray(draft.records) ? draft.records : null;
    const valid = fresh && records && (
      (draft.phase === "theory" && isIndex(draft.theoryIndex, shape.theoryCount)) ||
      (draft.phase === "words" && shape.hasWords) ||
      (draft.phase === "exercise" && isIndex(draft.index, shape.exerciseCount))
    );
    if (!valid) {
      storage.removeItem(key(userId, lessonId));
      return null;
    }
    return {
      phase: draft.phase as LessonDraftPhase,
      theoryIndex: draft.phase === "theory" ? draft.theoryIndex as number : 0,
      index: draft.phase === "exercise" ? draft.index as number : 0,
      records: records!,
      attemptsRemaining: Number.isInteger(draft.attemptsRemaining) && draft.attemptsRemaining! >= 0 && draft.attemptsRemaining! <= LESSON_ATTEMPTS
        ? draft.attemptsRemaining : LESSON_ATTEMPTS,
      savedAt: draft.savedAt as number,
    };
  } catch {
    return null;
  }
}

export function saveLessonDraft(
  userId: string | undefined,
  lessonId: string | undefined,
  draft: Omit<LessonDraft, "savedAt">,
  now = Date.now(),
  storage: KV | undefined = defaultStorage(),
): void {
  if (!userId || !lessonId || !storage) return;
  try {
    storage.setItem(key(userId, lessonId), JSON.stringify({ ...draft, savedAt: now }));
  } catch {
    // Storage full or blocked (private mode): resuming is a convenience only.
  }
}

export function clearLessonDraft(
  userId: string | undefined,
  lessonId: string | undefined,
  storage: KV | undefined = defaultStorage(),
): void {
  if (!userId || !lessonId || !storage) return;
  try {
    storage.removeItem(key(userId, lessonId));
  } catch {
    // ignore
  }
}
