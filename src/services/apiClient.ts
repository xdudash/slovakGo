import type { SyncMutation } from "../types";

const configuredBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
export const API_BASE_URL = (configuredBase || `${import.meta.env.BASE_URL}api`).replace(/\/$/, "");

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

  saveReminder(time: string | null) {
    return apiRequest<{ ok: boolean }>("/user/reminder", {
      method: "POST",
      body: JSON.stringify({ time })
    });
  },

  broadcastPush(title: string, body: string, target: string) {
    return apiRequest<{ ok: boolean; sent: number }>("/admin/notify", {
      method: "POST",
      body: JSON.stringify({ title, body, target })
    });
  },

  reportError(data: { message: string; stack?: string; url?: string }) {
    return apiRequest<{ ok: boolean }>("/errors", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  getAdminErrors(limit = 50) {
    return apiRequest<{ ok: boolean; errors: Array<{ id: string; userId: string | null; message: string; stack: string | null; url: string | null; userAgent: string | null; ip: string | null; createdAt: string }>; total: number }>(`/admin/errors?limit=${limit}`);
  },

  forgotPassword(email: string) {
    return apiRequest<{ ok: boolean }>("/auth/forgot", {
      method: "POST",
      body: JSON.stringify({ email })
    });
  },

  resetPassword(token: string, password: string) {
    return apiRequest<{ ok: boolean }>("/auth/reset", {
      method: "POST",
      body: JSON.stringify({ token, password })
    });
  },

  createCheckoutSession() {
    return apiRequest<{ url: string }>('/billing/checkout', { method: 'POST' });
  },

  openCustomerPortal() {
    return apiRequest<{ url: string }>('/billing/portal', { method: 'POST' });
  },

  claimReferral(referrerId: string) {
    return apiRequest<{ ok: boolean }>("/user/referral", {
      method: "POST",
      body: JSON.stringify({ referrerId })
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
  },

  getAdminUsers(opts: { search?: string; role?: string; sub?: string; page?: number; limit?: number } = {}) {
    const p = new URLSearchParams();
    if (opts.search) p.set("search", opts.search);
    if (opts.role)   p.set("role",   opts.role);
    if (opts.sub)    p.set("sub",    opts.sub);
    if (opts.page)   p.set("page",   String(opts.page));
    if (opts.limit)  p.set("limit",  String(opts.limit));
    const qs = p.toString();
    return apiRequest<{
      ok: boolean;
      total: number;
      users: Array<{
        id: string; email: string; name: string; avatar: string | null;
        role: string; level: string; country: string;
        subscriptionStatus: string; isBlocked: boolean;
        createdAt: string; lastSeenAt: string | null;
        xpTotal: number; streakDays: number; completedCount: number;
      }>;
    }>(`/admin/users${qs ? "?" + qs : ""}`);
  },

  getAdminUser(id: string) {
    return apiRequest<{
      ok: boolean;
      user: {
        id: string; email: string; name: string; avatar: string | null;
        role: string; level: string; country: string;
        subscriptionStatus: string; isBlocked: boolean;
        createdAt: string; lastSeenAt: string | null;
      };
      progress: {
        xpTotal: number; xpWeekly: number; xpDailyHistory: Record<string, number>;
        streakDays: number; completedLessons: string[]; mistakes: string[];
        hearts: number; maxHearts: number; lastPracticeDate: string | null;
        streakFreezeCount: number;
      };
    }>(`/admin/users/${id}`);
  },

  directAdminUpdateUser(id: string, patch: { role?: string; isBlocked?: boolean; subscriptionStatus?: string; level?: string }) {
    return apiRequest<{ ok: boolean; user: { id: string; role: string; isBlocked: boolean; subscriptionStatus: string; level: string } }>(
      `/admin/users/${id}`,
      { method: "POST", body: JSON.stringify(patch) }
    );
  },

  getLeaderboard() {
    return apiRequest<{
      ok: boolean;
      weekId: string;
      myRank: number | null;
      entries: Array<{ userId: string; name: string; avatar: string | null; country: string; xpWeekly: number; rank: number }>;
    }>("/leaderboard");
  },
};
