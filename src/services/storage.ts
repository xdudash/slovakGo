import { seedData } from "../data/seedData";
import type { AppData, Lesson } from "../types";

const STORAGE_KEY = "slovakgo.state.v1";
const LESSON_VERSION_KEY = "slovakgo.lessons.version.v1";
const SEED_USER_IDS = ["user-student", "user-teacher", "user-admin"];

function cloneSeed(): AppData {
  return JSON.parse(JSON.stringify(seedData)) as AppData;
}

const CONTENT_FIELDS = ["theoryScreens", "wordsScreen", "startScreen", "finalSituation", "resultScreen", "intro", "completionMessage"] as const;

export function toLessonShell(lesson: Lesson): Lesson {
  const shell: Lesson = { ...lesson, exercises: [], contentDeferred: true, contentLoaded: undefined };
  for (const field of CONTENT_FIELDS) delete (shell as unknown as Record<string, unknown>)[field];
  return shell;
}

function trimHeavyData(data: AppData): AppData {
  const cutoff = new Date(Date.now() - 90 * 86400_000).toISOString();
  const progress = Object.fromEntries(
    Object.entries(data.progress).map(([uid, p]) => [uid, {
      ...p,
      lessonAttempts: (p.lessonAttempts ?? []).slice(-20),
      mistakes:       (p.mistakes       ?? []).filter(m => !m.resolvedAt).slice(-100),
      xpDailyHistory: p.xpDailyHistory
        ? Object.fromEntries(Object.entries(p.xpDailyHistory).filter(([d]) => d >= cutoff.slice(0, 10)))
        : p.xpDailyHistory,
    }])
  );
  // Content loaded on demand stays in memory only: storing every opened lesson
  // in full would exceed the localStorage quota (the catalog is shells).
  const lessons = (data.lessons ?? []).map((lesson) => lesson.contentLoaded ? toLessonShell(lesson) : lesson);
  return { ...data, progress, lessons };
}

export const storageService = {
  load(): AppData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const data = cloneSeed();
        this.save(data);
        return data;
      }
      const parsed = JSON.parse(raw) as AppData;
      // Strip seed/demo users — keep only real registered users
      const realUsers = (parsed.users ?? []).filter(u => !SEED_USER_IDS.includes(u.id));
      const base = cloneSeed();
      if (realUsers.length > 0) {
        // Real users exist — use parsed data but replace users with only real ones
        return { ...base, ...parsed, users: realUsers };
      }
      // No real users — return full parsed (might be dev/demo mode)
      return { ...base, ...parsed };
    } catch {
      return cloneSeed();
    }
  },

  save(data: AppData): void {
    // Always trim before saving — prevents quota from filling up in the first place
    const payload = trimHeavyData({ ...data, updatedAt: new Date().toISOString() });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Still full after trim — last resort: drop attempts and mistakes entirely
      const minimal = { ...payload };
      for (const uid of Object.keys(minimal.progress)) {
        minimal.progress[uid] = { ...minimal.progress[uid], lessonAttempts: [], mistakes: [] };
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal)); } catch { /* give up */ }
    }
  },

  getLessonVersion(): string | undefined {
    return localStorage.getItem(LESSON_VERSION_KEY) || undefined;
  },

  setLessonVersion(version: string): void {
    localStorage.setItem(LESSON_VERSION_KEY, version);
  },

  reset(): AppData {
    localStorage.removeItem(LESSON_VERSION_KEY);
    const data = cloneSeed();
    this.save(data);
    return data;
  }
};
