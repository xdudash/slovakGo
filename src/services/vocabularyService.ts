import type { Lesson, UserWord, UserLevel, Word } from "../types";

export interface VocabularyWord extends Word {
  status: UserWord["status"];
  favorite: boolean;
  mistakeCount: number;
  correctCount: number;
  nextReviewAt?: string;
  lastSeenAt?: string;
}

const LEVELS: UserLevel[] = ["A0", "A1", "A2", "B1", "B2", "C1"];

export const vocabularyService = {
  build(lessons: Lesson[], userWords: UserWord[] = []): VocabularyWord[] {
    const progressByWord = new Map(userWords.map((item) => [item.wordId, item]));
    const words = lessons
      .filter((lesson) => lesson.isPublished)
      .flatMap((lesson) => lesson.words)
      .map((word) => {
        const progress = progressByWord.get(word.id);
        return {
          ...word,
          status: progress?.status || ("new" as UserWord["status"]),
          favorite: !!progress?.favorite,
          mistakeCount: progress?.mistakeCount || 0,
          correctCount: progress?.correctCount || 0,
          nextReviewAt: progress?.nextReviewAt,
          lastSeenAt: progress?.lastSeenAt,
        };
      });
    return Array.from(new Map(words.map((word) => [word.id, word])).values());
  },

  filter(words: VocabularyWord[], filter: string, query: string): VocabularyWord[] {
    return words.filter((word) => {
      const matchesQuery = `${word.sk} ${word.uk} ${word.topic}`.toLowerCase().includes(query.toLowerCase());
      if (!matchesQuery) return false;
      if (filter === "all") return true;
      if (filter === "favorite") return word.favorite;
      if (filter === "review") return word.status === "practicing" || word.mistakeCount > 0;
      return word.status === filter;
    });
  },

  sort(words: VocabularyWord[], sortBy: "alpha" | "level" | "topic" | "date"): VocabularyWord[] {
    return [...words].sort((a, b) => {
      if (sortBy === "alpha") return a.sk.localeCompare(b.sk, "sk");
      if (sortBy === "level") return LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level);
      if (sortBy === "topic") return a.topic.localeCompare(b.topic, "uk");
      // date: lastSeenAt desc; words without it go last
      if (!a.lastSeenAt && !b.lastSeenAt) return 0;
      if (!a.lastSeenAt) return 1;
      if (!b.lastSeenAt) return -1;
      return b.lastSeenAt.localeCompare(a.lastSeenAt);
    });
  },

  group(words: VocabularyWord[], groupBy: "topic" | "level"): { label: string; words: VocabularyWord[] }[] {
    const order: string[] = [];
    const map = new Map<string, VocabularyWord[]>();
    for (const word of words) {
      const label = groupBy === "level" ? word.level : word.topic;
      if (!map.has(label)) { order.push(label); map.set(label, []); }
      map.get(label)!.push(word);
    }
    return order.map((label) => ({ label, words: map.get(label)! }));
  },
};
