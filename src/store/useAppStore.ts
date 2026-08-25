import { create } from "zustand";
import { accessService } from "../services/accessService";
import { leaderboardService } from "../services/leaderboardService";
import { lessonService } from "../services/lessonService";
import { progressService } from "../services/progressService";
import { storageService } from "../services/storage";
import { syncService } from "../services/syncService";
import { apiClient } from "../services/apiClient";
import type { AnswerRecord, AppData, Lesson, User, UserLevel, UserRole, UserWord } from "../types";

interface AppStore {
  data: AppData;
  currentUserId?: string;
  authError?: string;
  syncMessage?: string;
  lastSyncedAt?: string;
  login: (email: string, password: string) => Promise<User | null>;
  register: (payload: { name: string; email: string; password: string; goal?: string }) => Promise<User | null>;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
  completeOnboarding: (goal: string, level: UserLevel) => void;
  setLevel: (level: UserLevel) => void;
  submitPlacement: (correct: number, total: number) => UserLevel;
  completeLesson: (lesson: Lesson, answers: AnswerRecord[]) => void;
  recordWrongAnswer: (lesson: Lesson, exerciseId: string, answer: string) => void;
  toggleFavorite: (wordId: string) => void;
  finishPracticeSession: (results: { wordId: string; correct: boolean }[]) => void;
  restoreHearts: () => void;
  upsertLesson: (lesson: Lesson) => void;
  bulkSetLessons: (lessons: Lesson[]) => void;
  deleteLesson: (lessonId: string) => void;
  adminUpdateUser: (userId: string, patch: Partial<User>) => void;
  loginAsUser: (userId: string) => void;
  returnToAdmin: () => void;
  refreshUser: () => Promise<void>;
  drainSync: () => Promise<void>;
  refreshLessons: () => Promise<void>;
  autoRestoreSession: () => Promise<boolean>;
  resetLocal: () => void;
}

const sessionKey = "slovakgo.current-user";
const defaultSettings = { language: "uk" as const, notificationsEnabled: true, soundEnabled: true, hapticsEnabled: true };

type RemoteState = {
  user: User;
  progress: AppData["progress"][string];
  userWords: UserWord[];
  lessons?: Lesson[];
  lessonVersion?: string;
};

function initialUserId(): string | undefined {
  return localStorage.getItem(sessionKey) || undefined;
}

function save(data: AppData): AppData {
  storageService.save(data);
  return data;
}

function withSync(data: AppData, type: string, payload: Record<string, unknown>) {
  return syncService.enqueue(data, type, payload);
}

function nextLessonId(lessons: Lesson[], completed: string[], level: UserLevel): string | undefined {
  return lessonService.byLevel(lessons, level).find((lesson) => !completed.includes(lesson.id))?.id;
}

function isCachedLessonCatalogComplete(version: string | undefined, data: AppData, role: UserRole | undefined): boolean {
  if (!version || !role) return false;
  const match = /^(all|published):(\d+):/.exec(version);
  if (!match) return false;
  const expectedScope = role === "teacher" || role === "admin" ? "all" : "published";
  if (match[1] !== expectedScope) return false;
  const localCount = expectedScope === "all"
    ? data.lessons.length
    : data.lessons.filter((lesson) => lesson.isPublished).length;
  return localCount === Number(match[2]);
}

function mergeRemoteState(data: AppData, remote: RemoteState): AppData {
  const userId = remote.user.id;
  const users = data.users.filter((user) => user.id !== userId);
  return {
    ...data,
    users: [...users, { ...remote.user, settings: { ...defaultSettings, ...remote.user.settings } }],
    progress: { ...data.progress, [userId]: { ...remote.progress, lessonAttempts: data.progress[userId]?.lessonAttempts ?? [] } },
    userWords: { ...data.userWords, [userId]: remote.userWords },
    lessons: remote.lessons?.length ? remote.lessons : data.lessons,
  };
}

export const useAppStore = create<AppStore>((set, get) => ({
  data: storageService.load(),
  currentUserId: initialUserId(),

  async login(email, password) {
    if (!email.trim()) {
      set({ authError: "Введіть email" });
      return null;
    }
    set({ authError: undefined });

    let serverUser: User;
    try {
      const { user: raw } = await apiClient.login(email, password);
      serverUser = raw as User;
    } catch (err: unknown) {
      const e = err as { status?: number };
      if (e.status === 401 || e.status === 422 || e.status === 404) {
        set({ authError: "Невірний email або пароль" });
      } else {
        set({ authError: "Сервер недоступний. Перевір з'єднання." });
      }
      return null;
    }

    const userId = serverUser.id;
    let data = get().data;

    try {
      const fullState = await apiClient.syncPull(0, false) as RemoteState;
      data = mergeRemoteState(data, fullState);
    } catch {
      // syncPull failed — log in with local data so a server hiccup doesn't block the user
      const users = data.users.filter(u => u.id !== userId);
      data = {
        ...data,
        users: [...users, { ...serverUser, settings: { ...defaultSettings, ...serverUser.settings } }],
      };
    }

    save(data);
    localStorage.setItem(sessionKey, userId);
    set({ data, currentUserId: userId, authError: undefined });
    get().refreshLessons().catch(() => undefined);
    get().drainSync().catch(() => undefined);
    return data.users.find((u) => u.id === userId) ?? null;
  },

  async autoRestoreSession() {
    try {
      const fullState = await apiClient.syncPull(0, false) as RemoteState;
      const userId = fullState.user.id;
      const data = mergeRemoteState(get().data, fullState);

      save(data);
      localStorage.setItem(sessionKey, userId);
      set({ data, currentUserId: userId, authError: undefined });
      get().refreshLessons().catch(() => undefined);
      get().drainSync().catch(() => undefined);
      return true;
    } catch (err: unknown) {
      if (err && typeof err === "object" && "status" in err && (err as { status: unknown }).status === 401) {
        get().logout();
      }
      return false;
    }
  },

  async register(payload) {
    if (!payload.name.trim()) {
      set({ authError: "Введіть ім'я" });
      return null;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      set({ authError: "Введіть коректний email" });
      return null;
    }
    if (
      payload.password.length < 8 ||
      !/[A-ZА-ЯІЇЄҐ]/.test(payload.password) ||
      !/[a-zа-яіїєґ]/.test(payload.password) ||
      !/\d/.test(payload.password)
    ) {
      set({ authError: "Пароль має містити мінімум 8 символів, велику та малу літеру і цифру" });
      return null;
    }
    set({ authError: undefined });

    const tentativeId = `user-${crypto.randomUUID()}`;
    try {
      await apiClient.register(tentativeId, payload.name.trim(), payload.email, payload.password, payload.goal);

      const fullState = await apiClient.syncPull(0, false) as RemoteState;
      const userId = fullState.user.id;
      const data = mergeRemoteState(get().data, fullState);

      save(data);
      localStorage.setItem(sessionKey, userId);
      set({ data, currentUserId: userId, authError: undefined });

      get().refreshLessons().catch(() => undefined);
      get().drainSync().catch(() => undefined);
      return data.users.find((u) => u.id === userId) ?? null;
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      if (e.status === 409) {
        set({ authError: "Email вже зареєстрований" });
      } else if (e.status === 422) {
        set({ authError: e.message || "Перевір введені дані" });
      } else {
        set({ authError: "Не вдалося зареєструватися. Перевір з'єднання." });
      }
      return null;
    }
  },

  async refreshUser() {
    const currentUserId = get().currentUserId;
    if (!currentUserId) return;
    try {
      const fullState = await apiClient.syncPull(0, false) as RemoteState;
      const data = mergeRemoteState(get().data, fullState);
      save(data);
      set({ data });
      get().refreshLessons().catch(() => undefined);
    } catch {
      // non-fatal — store remains as-is
    }
  },

  async refreshLessons() {
    const { currentUserId, data: currentData } = get();
    if (!currentUserId) return;
    try {
      const role = currentData.users.find((user) => user.id === currentUserId)?.role;
      const storedVersion = storageService.getLessonVersion();
      // The version key and lesson payload live in separate localStorage writes.
      // If the payload was truncated/reset, force a full catalog response instead
      // of accepting an "unchanged" response for an incomplete local catalog.
      const currentVersion = isCachedLessonCatalogComplete(storedVersion, currentData, role)
        ? storedVersion
        : undefined;
      const response = await apiClient.lessonsPull(currentVersion);
      if (response.unchanged) return;
      const lessons = response.lessons as Lesson[] | undefined;
      if (!lessons?.length) return;
      const data = save({ ...get().data, lessons });
      storageService.setLessonVersion(response.version);
      set({ data });
    } catch {
      // Cached lessons remain available when the background refresh fails.
    }
  },

  logout() {
    localStorage.removeItem(sessionKey);
    apiClient.logout().catch(() => undefined);
    set({ currentUserId: undefined });
  },

  updateUser(patch) {
    const currentUserId = get().currentUserId;
    if (!currentUserId) return;
    let data: AppData = {
      ...get().data,
      users: get().data.users.map((user) => (user.id === currentUserId ? { ...user, ...patch, lastActiveAt: new Date().toISOString() } : user))
    };
    data = withSync(data, "profile.update", patch as Record<string, unknown>);
    save(data);
    set({ data });
  },

  completeOnboarding(goal, level) {
    const currentUserId = get().currentUserId;
    if (!currentUserId) return;
    const progress = get().data.progress[currentUserId];
    const currentLessonId = nextLessonId(get().data.lessons, progress.completedLessons, level);
    let data: AppData = {
      ...get().data,
      users: get().data.users.map((user) => (user.id === currentUserId ? { ...user, goal, level, onboardingDone: true } : user)),
      progress: {
        ...get().data.progress,
        [currentUserId]: { ...progress, currentLevel: level, currentLessonId, updatedAt: new Date().toISOString() }
      }
    };
    data = withSync(data, "profile.update", { goal, level, onboardingDone: true });
    save(data);
    set({ data });
  },

  setLevel(level) {
    const currentUserId = get().currentUserId;
    if (!currentUserId) return;
    const progress = get().data.progress[currentUserId];
    const currentLessonId = nextLessonId(get().data.lessons, progress.completedLessons, level);
    let data: AppData = {
      ...get().data,
      users: get().data.users.map((user) => (user.id === currentUserId ? { ...user, level } : user)),
      progress: { ...get().data.progress, [currentUserId]: { ...progress, currentLevel: level, currentLessonId, updatedAt: new Date().toISOString() } }
    };
    data = withSync(data, "profile.update", { level });
    save(data);
    set({ data });
  },

  submitPlacement(correct, total) {
    const ratio = total > 0 ? correct / total : 0;
    const level: UserLevel = ratio >= 0.75 ? "A2" : ratio >= 0.45 ? "A1" : "A0";
    get().setLevel(level);
    return level;
  },

  completeLesson(lesson, answers) {
    const currentUserId = get().currentUserId;
    if (!currentUserId) return;
    const subStatus = get().data.users.find((u) => u.id === currentUserId)?.subscriptionStatus;
    const progress = progressService.completeLesson(get().data.progress[currentUserId], lesson, answers, subStatus);
    const xpEarned = progress.lessonAttempts[progress.lessonAttempts.length - 1]?.xpEarned ?? 0;
    const userWords = lesson.words.reduce<UserWord[]>((words, word) => progressService.touchWord(currentUserId, word.id, words, true), get().data.userWords[currentUserId] || []);
    let data: AppData = {
      ...get().data,
      progress: { ...get().data.progress, [currentUserId]: { ...progress, currentLessonId: nextLessonId(get().data.lessons, progress.completedLessons, progress.currentLevel) } },
      userWords: { ...get().data.userWords, [currentUserId]: userWords }
    };
    data = { ...data, leaderboard: leaderboardService.recalculate(data.leaderboard, data.users, data.progress) };
    data = withSync(data, "lesson.complete", { lessonId: lesson.id, answers, xpEarned });
    save(data);
    set({ data });
    // Push to server immediately — don't wait for next login
    get().drainSync().catch(() => undefined);
    // Notification permission is requested from the lesson result screen
    // (ReminderOptIn), so the learner taps an in-app card before the system
    // dialog appears instead of getting it unannounced here.
  },

  recordWrongAnswer(lesson, exerciseId, answer) {
    const currentUserId = get().currentUserId;
    if (!currentUserId) return;
    const exercise = lesson.exercises.find((item) => item.id === exerciseId);
    if (!exercise) return;
    const progress = progressService.wrong(get().data.progress[currentUserId], lesson, exercise, answer);
    const userWords = (exercise.wordIds || []).reduce<UserWord[]>((words, wordId) => progressService.touchWord(currentUserId, wordId, words, false), get().data.userWords[currentUserId] || []);
    let data: AppData = {
      ...get().data,
      progress: { ...get().data.progress, [currentUserId]: progress },
      userWords: { ...get().data.userWords, [currentUserId]: userWords }
    };
    data = withSync(data, "exercise.wrong", { lessonId: lesson.id, exerciseId, answer });
    save(data);
    set({ data });
  },

  toggleFavorite(wordId) {
    const currentUserId = get().currentUserId;
    if (!currentUserId) return;
    const words = get().data.userWords[currentUserId] || [];
    const existing = words.find((word) => word.wordId === wordId);
    const next: UserWord = existing
      ? { ...existing, favorite: !existing.favorite }
      : { userId: currentUserId, wordId, status: "new", mistakeCount: 0, correctCount: 0, favorite: true };
    let data: AppData = {
      ...get().data,
      userWords: { ...get().data.userWords, [currentUserId]: [...words.filter((word) => word.wordId !== wordId), next] }
    };
    data = withSync(data, "word.update", { wordId, favorite: next.favorite });
    save(data);
    set({ data });
  },

  finishPracticeSession(results) {
    const currentUserId = get().currentUserId;
    if (!currentUserId) return;
    const subStatus = get().data.users.find((u) => u.id === currentUserId)?.subscriptionStatus;
    const progress = progressService.practiceDone(get().data.progress[currentUserId], subStatus);
    const userWords = results.reduce<UserWord[]>(
      (words, { wordId, correct }) => progressService.touchWord(currentUserId, wordId, words, correct),
      get().data.userWords[currentUserId] || []
    );
    let data: AppData = {
      ...get().data,
      progress: { ...get().data.progress, [currentUserId]: progress },
      userWords: { ...get().data.userWords, [currentUserId]: userWords },
    };
    data = { ...data, leaderboard: leaderboardService.recalculate(data.leaderboard, data.users, data.progress) };
    data = withSync(data, "practice.complete", { results: results as unknown as Record<string, unknown> });
    save(data);
    set({ data });
  },

  restoreHearts() {
    const currentUserId = get().currentUserId;
    if (!currentUserId) return;
    const progress = progressService.restoreHearts(get().data.progress[currentUserId]);
    let data = { ...get().data, progress: { ...get().data.progress, [currentUserId]: progress } };
    data = withSync(data, "hearts.restore", {});
    save(data);
    set({ data });
  },

  upsertLesson(lesson) {
    let lessons = get().data.lessons;
    lessons = lessons.some((item) => item.id === lesson.id) ? lessons.map((item) => (item.id === lesson.id ? lesson : item)) : [...lessons, lesson];
    let data = { ...get().data, lessons };
    data = withSync(data, "lesson.upsert", { lesson });
    save(data);
    set({ data });
  },

  bulkSetLessons(incoming) {
    const map = new Map(get().data.lessons.map((l) => [l.id, l]));
    for (const l of incoming) map.set(l.id, l);
    const data = { ...get().data, lessons: [...map.values()] };
    save(data);
    set({ data });
  },

  deleteLesson(lessonId) {
    let data = { ...get().data, lessons: get().data.lessons.filter((lesson) => lesson.id !== lessonId) };
    data = withSync(data, "lesson.delete", { lessonId });
    save(data);
    set({ data });
  },

  adminUpdateUser(userId, patch) {
    let data = { ...get().data, users: get().data.users.map((user) => (user.id === userId ? { ...user, ...patch } : user)) };
    data = withSync(data, "admin.user.update", { userId, ...patch });
    save(data);
    set({ data });
  },

  loginAsUser(userId) {
    const adminReturnKey = "slovakgo.admin-return";
    const current = get().currentUserId;
    if (current) localStorage.setItem(adminReturnKey, current);
    localStorage.setItem(sessionKey, userId);
    set({ currentUserId: userId });
  },

  returnToAdmin() {
    const adminReturnKey = "slovakgo.admin-return";
    const adminId = localStorage.getItem(adminReturnKey);
    if (!adminId) return;
    localStorage.setItem(sessionKey, adminId);
    localStorage.removeItem(adminReturnKey);
    set({ currentUserId: adminId });
  },

  async drainSync() {
    const data = await syncService.drain(get().data);
    if (data !== get().data) {
      save(data);
      const now = new Date().toISOString();
      set({ data, syncMessage: "✓ Синхронізовано", lastSyncedAt: now });
      setTimeout(() => set({ syncMessage: undefined }), 3000);
    }
  },

  resetLocal() {
    const data = storageService.reset();
    localStorage.removeItem(sessionKey);
    set({ data, currentUserId: undefined });
  }
}));

export function selectCurrentUser(data: AppData, currentUserId?: string) {
  return data.users.find((user) => user.id === currentUserId);
}

export function selectIsPlus(data: AppData, currentUserId?: string): boolean {
  const user = selectCurrentUser(data, currentUserId);
  if (!user) return false;
  return accessService.hasFullAccess(user.subscriptionStatus);
}

export function roleHome(role: UserRole): string {
  if (role === "admin") return "/admin";
  if (role === "teacher") return "/teacher";
  return "/app/path";
}
