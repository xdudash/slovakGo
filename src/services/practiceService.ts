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

function distractors(
  pool: VocabularyWord[],
  excludeId: string,
  valueOf: (word: VocabularyWord) => string,
  count: number
): string[] {
  return shuffle(pool.filter((word) => word.id !== excludeId))
    .map(valueOf)
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .slice(0, count);
}

export const practiceService = {
  generate(
    words: VocabularyWord[],
    allWords: VocabularyWord[],
    count: number,
    types: Set<PracticeType>,
    translationOf: (word: VocabularyWord) => string = (word) => word.uk
  ): PracticeExercise[] {
    const candidates: PracticeExercise[] = [];

    for (const word of words) {
      const translation = translationOf(word) || word.uk;
      if (types.has("translation")) {
        const opts = shuffle([translation, ...distractors(allWords, word.id, translationOf, 3)]);
        candidates.push({
          wordId: word.id,
          exercise: {
            id: crypto.randomUUID(),
            lessonId: "practice",
            type: "multiple_choice_translation",
            question: word.sk,
            correctAnswer: translation,
            options: opts,
            wordIds: [word.id],
            order: 0,
          },
        });
      }
      if (types.has("reverse")) {
        const opts = shuffle([word.sk, ...distractors(allWords, word.id, (item) => item.sk, 3)]);
        candidates.push({
          wordId: word.id,
          exercise: {
            id: crypto.randomUUID(),
            lessonId: "practice",
            type: "reverse_translation",
            question: translation,
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
            correctAnswer: translation,
            wordIds: [word.id],
            order: 0,
          },
        });
      }
    }

    return shuffle(candidates).slice(0, count);
  },
};
