import { apiClient } from "./apiClient";
import { idbDelete, idbGetAll, idbPut } from "./idbQueue";
import type { AppData, SyncMutation } from "../types";

const CLIENT_KEY = "slovak-life.client-id";

function clientId(): string {
  let id = localStorage.getItem(CLIENT_KEY);
  if (!id) {
    id = `web-${crypto.randomUUID()}`;
    localStorage.setItem(CLIENT_KEY, id);
  }
  return id;
}

export const syncService = {
  enqueue(data: AppData, type: string, payload: Record<string, unknown>): AppData {
    const mutation: SyncMutation = {
      id: crypto.randomUUID(),
      type,
      payload,
      createdAt: new Date().toISOString()
    };
    idbPut(mutation).catch(() => undefined);
    return { ...data, syncQueue: [...data.syncQueue, mutation] };
  },

  async drain(data: AppData): Promise<AppData> {
    if (!data.syncQueue.length || !navigator.onLine) return data;
    try {
      await apiClient.syncPush(clientId(), data.syncQueue);
      await Promise.all(data.syncQueue.map((m) => idbDelete(m.id).catch(() => undefined)));
      return { ...data, syncQueue: [] };
    } catch {
      return data;
    }
  },

  async recover(currentQueue: SyncMutation[]): Promise<SyncMutation[]> {
    const idbMutations = await idbGetAll().catch(() => [] as SyncMutation[]);
    const currentIds = new Set(currentQueue.map((m) => m.id));
    return idbMutations.filter((m) => !currentIds.has(m.id));
  },

  status(data: AppData) {
    return {
      clientId: clientId(),
      pending: data.syncQueue.length,
      online: navigator.onLine
    };
  }
};
