import { apiClient } from "./apiClient";
import { idbDelete, idbGetAll, idbPut } from "./idbQueue";
import type { AppData, SyncMutation } from "../types";

const CLIENT_KEY = "slovakgo.client-id";

function clientId(): string {
  let id = localStorage.getItem(CLIENT_KEY);
  if (!id) {
    id = `web-${crypto.randomUUID()}`;
    localStorage.setItem(CLIENT_KEY, id);
  }
  return id;
}

function belongsToUser(mutation: SyncMutation, userId: string): boolean {
  return mutation.userId === userId;
}

export const syncService = {
  enqueue(data: AppData, userId: string, type: string, payload: Record<string, unknown>): AppData {
    const mutation: SyncMutation = {
      id: crypto.randomUUID(),
      userId,
      type,
      payload,
      createdAt: new Date().toISOString()
    };
    idbPut(mutation).catch(() => undefined);
    return { ...data, syncQueue: [...data.syncQueue, mutation] };
  },

  async drain(data: AppData, userId: string): Promise<AppData> {
    // Drop legacy ownerless entries from localStorage rather than risk replaying
    // another account's offline actions under the currently authenticated user.
    const validQueue = data.syncQueue.filter((m) => typeof m.userId === "string" && m.userId.length > 0);
    const owned = validQueue.filter((m) => belongsToUser(m, userId));
    const others = validQueue.filter((m) => !belongsToUser(m, userId));

    if (!owned.length || !navigator.onLine) {
      return validQueue.length === data.syncQueue.length ? data : { ...data, syncQueue: validQueue };
    }

    try {
      await apiClient.syncPush(clientId(), owned);
      await Promise.all(owned.map((m) => idbDelete(m.id).catch(() => undefined)));
      return { ...data, syncQueue: others };
    } catch {
      return validQueue.length === data.syncQueue.length ? data : { ...data, syncQueue: validQueue };
    }
  },

  async recover(currentQueue: SyncMutation[], userId: string): Promise<SyncMutation[]> {
    const idbMutations = await idbGetAll().catch(() => [] as SyncMutation[]);
    const currentIds = new Set(currentQueue.map((m) => m.id));

    // Old queue records had no owner. Delete them: replaying them would be a
    // cross-account data-corruption risk after logout/login in the same browser.
    await Promise.all(
      idbMutations
        .filter((m) => !m.userId)
        .map((m) => idbDelete(m.id).catch(() => undefined))
    );

    return idbMutations.filter((m) => belongsToUser(m, userId) && !currentIds.has(m.id));
  },

  status(data: AppData, userId?: string) {
    return {
      clientId: clientId(),
      pending: userId ? data.syncQueue.filter((m) => m.userId === userId).length : data.syncQueue.length,
      online: navigator.onLine
    };
  }
};
