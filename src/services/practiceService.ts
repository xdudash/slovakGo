import type { Exercise } from "../types";
import type { VocabularyWord } from "./vocabularyService";

export interface PracticeExercise {
  exercise: Exercise;
  wordId: string;
}

export type PracticeType = "translation" | "reverse" | "typing";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function distractors(pool: VocabularyWord[], excludeId: string, field: "sk" | "uk", count: number): string[] {
  return shuffle(pool.filter((w) => w.id !== excludeId))
    .slice(0, count)
    .map((w) => w[field]);
}

export const practiceService = {
  generate(
    words: VocabularyWord[],
    allWords: VocabularyWord[],
    count: number,
    types: Set<PracticeType>
  ): PracticeExercise[] {
    const candidates: PracticeExercise[] = [];

    for (const word of words) {
      if (types.has("translation")) {
        const opts = shuffle([word.uk, ...distractors(allWords, word.id, "uk", 3)]);
        candidates.push({
          wordId: word.id,
          exercise: {
            id: crypto.randomUUID(),
            lessonId: "practice",
            type: "multiple_choice_translation",
            question: word.sk,
            correctAnswer: word.uk,
            options: opts,
            wordIds: [word.id],
            order: 0,
          },
        });
      }
      if (types.has("reverse")) {
        const opts = shuffle([word.sk, ...distractors(allWords, word.id, "sk", 3)]);
        candidates.push({
          wordId: word.id,
          exercise: {
            id: crypto.randomUUID(),
            lessonId: "practice",
            type: "reverse_translation",
            question: word.uk,
            correctAnswer: word.sk,
            options: opts,
            wordIds: [word.id],
            order: 0,
          },
        });
      }
      if (types.has("typing")) {
        candidates.push({
          wordId: word.id,
          exercise: {
            id: crypto.randomUUID(),
            lessonId: "practice",
            type: "typing",
            question: word.sk,
            correctAnswer: word.uk,
            wordIds: [word.id],
            order: 0,
          },
        });
      }
    }

    return shuffle(candidates).slice(0, count);
  },
};
