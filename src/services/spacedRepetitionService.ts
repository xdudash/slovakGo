import type { VocabularyWord } from "./vocabularyService";

// Consecutive-correct → days until next review
const INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export const srService = {
  /**
   * Returns an ISO date string for the next review.
   * afterMistake → reset to 1 day; otherwise use correctCount ladder.
   */
  nextReviewDate(correctCount: number, afterMistake: boolean): string {
    const days: number = afterMistake
      ? INTERVAL_DAYS[0]
      : INTERVAL_DAYS[Math.min(correctCount, INTERVAL_DAYS.length - 1)];
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  },

  /** How many non-mastered words are due for review today or overdue. */
  dueCount(words: VocabularyWord[]): number {
    const today = todayISO();
    return words.filter(
      (w) => w.status !== "mastered" && w.nextReviewAt != null && w.nextReviewAt.slice(0, 10) <= today
    ).length;
  },

  /**
   * Select up to `count` words for adaptive practice.
   *
   * Priority:
   *   1. Overdue (nextReviewAt < today)  — sorted by days overdue desc
   *   2. Due today
   *   3. Has mistakes, not yet scheduled
   *   4. New (never reviewed)
   *   5. Random fill from any remaining words
   */
  selectWords(allWords: VocabularyWord[], count: number): VocabularyWord[] {
    const today = todayISO();

    function score(w: VocabularyWord): number {
      if (w.nextReviewAt == null) {
        return w.mistakeCount > 0 ? 50 + w.mistakeCount : 10;
      }
      const day = w.nextReviewAt.slice(0, 10);
      if (day < today) {
        const overdue = Math.floor((Date.now() - new Date(day).getTime()) / 86_400_000);
        return 1000 + overdue;
      }
      if (day === today) return 500;
      return w.mistakeCount > 0 ? 50 + w.mistakeCount : 1;
    }

    const nonMastered = allWords.filter((w) => w.status !== "mastered");
    const sorted = [...nonMastered].sort((a, b) => score(b) - score(a));
    const selected = sorted.slice(0, count);

    // Fill remaining slots with random words (including mastered for variety)
    if (selected.length < count) {
      const ids = new Set(selected.map((w) => w.id));
      const fill = allWords
        .filter((w) => !ids.has(w.id))
        .sort(() => Math.random() - 0.5)
        .slice(0, count - selected.length);
      selected.push(...fill);
    }

    return selected;
  },
};
