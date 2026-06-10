import type { SyncMutation } from "../types";

const configuredBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
export const API_BASE_URL = (configuredBase || `${import.meta.env.BASE_URL}api/index.php`).replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload.error || "Помилка сервера", response.status, payload);
  }
  return payload as T;
}

export const apiClient = {
  register(id: string, name: string, email: string, password: string, goal?: string) {
    return apiRequest<{ ok: boolean; user: unknown }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ id, name, email, password, goal })
    });
  },

  login(email: string, password: string) {
    return apiRequest<{ ok: boolean; user: unknown }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },

  logout() {
    return apiRequest<{ ok: boolean }>("/auth/logout", { method: "POST" });
  },

  serverTime() {
    return apiRequest<{ ok: boolean; updatedAt: string }>("/");
  },

  syncPush(clientId: string, mutations: SyncMutation[]) {
    return apiRequest<{ ok: boolean; applied: number }>("/sync/push", {
      method: "POST",
      body: JSON.stringify({ clientId, mutations })
    });
  },

  syncPull(since: number) {
    return apiRequest<unknown>(`/sync/pull?since=${since}`);
  },

  changeEmail(newEmail: string) {
    return apiRequest<{ ok: boolean }>("/user/email", {
      method: "POST",
      body: JSON.stringify({ email: newEmail })
    });
  },

  changePassword(currentPassword: string, newPassword: string) {
    return apiRequest<{ ok: boolean }>("/user/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword })
    });
  },

  deleteAccount(confirmEmail: string) {
    return apiRequest<{ ok: boolean }>("/auth/delete", {
      method: "POST",
      body: JSON.stringify({ confirmEmail })
    });
  },

  deactivateAccount() {
    return apiRequest<{ ok: boolean }>("/auth/deactivate", { method: "POST" });
  },

  saveFcmToken(token: string) {
    return apiRequest<{ ok: boolean }>("/user/fcm-token", {
      method: "POST",
      body: JSON.stringify({ token, platform: "web" })
    });
  },

  getAdminStats() {
    return apiRequest<{
      ok: boolean;
      summary: {
        totalUsers: number;
        active24h: number;
        active7d: number;
        plusUsers: number;
        avgXP: number;
        avgStreak: number;
      };
      levels: Record<string, number>;
      dailyRegistrations: Array<{ date: string; count: number }>;
    }>("/admin/stats");
  }
};
