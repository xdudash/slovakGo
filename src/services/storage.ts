import { seedData } from "../data/seedData";
import type { AppData } from "../types";

const STORAGE_KEY = "slovakgo.state.v1";

function cloneSeed(): AppData {
  return JSON.parse(JSON.stringify(seedData)) as AppData;
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
  return { ...data, progress };
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
      return { ...cloneSeed(), ...parsed };
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

  reset(): AppData {
    const data = cloneSeed();
    this.save(data);
    return data;
  }
};
