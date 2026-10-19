import type { Progress, SyncMutation, User, UserWord } from "../types";

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

export async function apiRequest<T>(path: string, init: RequestInit = {}, timeoutMs = 10_000): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new ApiError("Сервер не відповідає. Перевір з'єднання.", 408);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload.error || "Помилка сервера", response.status, payload);
  }
  return payload as T;
}

export interface CoursePlan {
  course: number;
  levels: Record<string, number>;
  existing: number;
  toInsert: number;
  toUpdate: number;
  toDelete: number;
  oldSample: string[];
  lastBackup: { id: string; at: string; lessons: number } | null;
}

export const apiClient = {
  register(id: string, name: string, email: string, password: string, goal?: string, marketingConsent = false) {
    return apiRequest<{ ok: boolean; user: unknown }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ id, name, email, password, goal, marketingConsent })
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
    return apiRequest<{ ok: boolean; updatedAt: string }>("/ping");
  },

  syncPush(clientId: string, mutations: SyncMutation[]) {
    return apiRequest<{ ok: boolean; applied: number }>("/sync/push", {
      method: "POST",
      body: JSON.stringify({ clientId, mutations })
    });
  },

  syncPull(since: number, includeLessons = true) {
    return apiRequest<unknown>(`/sync/pull?since=${since}&includeLessons=${includeLessons ? "1" : "0"}`);
  },

  getLesson(id: string) {
    return apiRequest<{ ok: boolean; lesson: unknown }>(`/lessons/${encodeURIComponent(id)}`, {}, 20_000);
  },

  exportLessonsPage(offset: number) {
    return apiRequest<{ ok: boolean; lessons: unknown[]; total: number; next: number }>(`/admin/lessons/export?offset=${offset}&limit=100`, {}, 30_000);
  },

  lessonsPull(version?: string) {
    const query = version ? `?version=${encodeURIComponent(version)}` : "";
    return apiRequest<{ ok: boolean; unchanged: boolean; version: string; lessons?: unknown[] }>(`/lessons${query}`, {}, 20_000);
  },

  getEmailPreferences() { return apiRequest<{ marketingConsent: boolean }>("/user/email-preferences"); },
  setMarketingConsent(marketingConsent: boolean) {
    return apiRequest<{ marketingConsent: boolean }>("/user/email-preferences", { method: "POST", body: JSON.stringify({ marketingConsent }) });
  },
  changeEmail(newEmail: string, currentPassword: string) {
    return apiRequest<{ ok: boolean }>("/user/email", {
      method: "POST",
      body: JSON.stringify({ email: newEmail, currentPassword })
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

  saveFcmToken(token: string | null) {
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

  createCheckoutSession(planType: "monthly" | "yearly" = "monthly") {
    return apiRequest<{ url: string }>('/billing/checkout', { 
      method: 'POST',
      body: JSON.stringify({ planType, acceptTerms: true })
    });
  },

  openCustomerPortal() {
    return apiRequest<{ url: string }>('/billing/portal', { method: 'POST' });
  },

  claimDemoCompletion() {
    return apiRequest<{ ok: boolean; awarded: boolean }>("/user/demo-complete", { method: "POST" });
  },

  claimReferral(referrerId: string) {
    return apiRequest<{ ok: boolean }>("/user/referral", {
      method: "POST",
      body: JSON.stringify({ referrerId })
    });
  },

  getTeacherStats() {
    return apiRequest<{
      ok: boolean;
      summary: { students: number; completions: number; mistakes: number; lessons: number };
      lessons: Array<{ id: string; title: unknown; exercises: number; completions: number }>;
    }>("/teacher/stats");
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

  getAdminUsers(opts: { search?: string; role?: string; sub?: string; activity?: string; progress?: string; marketing?: string; offset?: number; limit?: number } = {}) {
    const p = new URLSearchParams();
    if (opts.search) p.set("search", opts.search);
    if (opts.role)   p.set("role",   opts.role);
    if (opts.sub)    p.set("sub",    opts.sub);
    if (opts.offset) p.set("offset", String(opts.offset));
    for (const key of ["activity", "progress", "marketing"] as const) if (opts[key]) p.set(key, opts[key]!);
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
        activeSeconds: number; sessionCount: number; visits: number; marketingConsent: boolean;
      }>;
    }>(`/admin/users${qs ? "?" + qs : ""}`);
  },

  async exportAdminUsers(opts: Record<string, string> = {}) {
    const params = new URLSearchParams({ ...opts, format: "csv" });
    const response = await fetch(`${API_BASE_URL}/admin/users?${params}`, { credentials: "include", cache: "no-store" });
    if (!response.ok) throw new Error("Не вдалося експортувати користувачів");
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a"); link.href = url;
    link.download = `users-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  getAdminUser(id: string) {
    return apiRequest<{
      ok: boolean;
      user: User;
      progress: Progress;
      userWords: UserWord[];
      activity: { activeSeconds: number; visits: number; sessionCount: number; lastActiveAt: string | null; sessions: Array<{ id: string; started_at: string; last_active_at: string; ended_at: string | null; active_seconds: number; visits: number }> };
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

  getCoursePlan() {
    return apiRequest<{ ok: boolean; plan: CoursePlan }>("/admin/course", {}, 55_000);
  },

  courseStep(body: { step: "backup" } | { step: "upsert"; offset: number; limit?: number } | { step: "cleanup" }) {
    return apiRequest<{ ok: boolean; backupId?: string; lessons?: number; written?: number; next?: number; total?: number; done?: boolean; deleted?: number }>("/admin/course", {
      method: "POST",
      body: JSON.stringify(body),
    }, 55_000);
  },

  importLessons(lessons: unknown[], mode: "skip" | "overwrite") {
    return apiRequest<{
      ok: boolean;
      imported: number;
      skipped: number;
      errors: Array<{ id: string; error: string }>;
    }>("/admin/lessons/import", {
      method: "POST",
      body: JSON.stringify({ lessons, mode })
    });
  },

  sendSupportMessage(topic: string, message: string) {
    return apiRequest<{ ok: boolean }>("/support/send", {
      method: "POST",
      body: JSON.stringify({ topic, message, appVersion: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "—" }),
    });
  },
};

/** Every lesson in full, fetched page by page (admin/teacher export and backups). */
export async function fetchAllLessons(): Promise<unknown[]> {
  const all: unknown[] = [];
  for (let offset = 0; ; ) {
    const page = await apiClient.exportLessonsPage(offset);
    all.push(...page.lessons);
    if (!page.lessons.length || page.next >= page.total) break;
    offset = page.next;
  }
  return all;
}
