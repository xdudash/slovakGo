import { seedData } from "../data/seedData";
import type { AppData } from "../types";

const STORAGE_KEY = "slovak-life.mvp.state.v1";

function cloneSeed(): AppData {
  return JSON.parse(JSON.stringify(seedData)) as AppData;
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }));
  },

  reset(): AppData {
    const data = cloneSeed();
    this.save(data);
    return data;
  }
};
