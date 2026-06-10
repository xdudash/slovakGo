import { create } from "zustand";
import { createProgress } from "../data/seedData";
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
  register: (payload: { name: string; email: string; password: string; goal?: string }) => User | null;
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
  deleteLesson: (lessonId: string) => void;
  adminUpdateUser: (userId: string, patch: Partial<User>) => void;
  drainSync: () => Promise<void>;
  resetLocal: () => void;
}

const sessionKey = "slovak-life.current-user";

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

export const useAppStore = create<AppStore>((set, get) => ({
  data: storageService.load(),
  currentUserId: initialUserId(),

  async login(email, password) {
    if (!email.trim()) {
      set({ authError: "Введіть email" });
      return null;
    }
    set({ authError: undefined });
    try {
      const { user: raw } = await apiClient.login(email, password);
      const serverUser = raw as User;
      // Ensure settings has all required fields
      const defaults = { language: "uk" as const, notificationsEnabled: true, soundEnabled: true, hapticsEnabled: true };
      const merged: User = { ...serverUser, settings: { ...defaults, ...serverUser.settings } };

      const users = get().data.users;
      const existing = users.find((u) => u.id === merged.id)
                    ?? users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      let data = get().data;
      let userId: string;

      if (existing) {
        // Update local record with authoritative server fields
        userId = existing.id;
        data = { ...data, users: users.map((u) => u.id === userId ? { ...u, ...merged, id: userId } : u) };
      } else {
        // First login on this device — bootstrap from server data
        userId = merged.id;
        data = {
          ...data,
          users: [...users, merged],
          progress: { ...data.progress, [userId]: createProgress(userId, merged.level ?? "A0") },
          userWords: { ...data.userWords, [userId]: [] }
        };
      }

      save(data);
      localStorage.setItem(sessionKey, userId);
      set({ data, currentUserId: userId, authError: undefined });
      // Pull server state in background to restore full progress on new devices
      get().drainSync().catch(() => undefined);
      return data.users.find((u) => u.id === userId) ?? null;
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      if (e.status === 401 || e.status === 422 || e.status === 404) {
        set({ authError: "Невірний email або пароль" });
      } else {
        set({ authError: "Сервер недоступний. Перевір з'єднання." });
      }
      return null;
    }
  },

  register(payload) {
    if (!payload.name.trim()) {
      set({ authError: "Введіть ім'я" });
      return null;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      set({ authError: "Введіть коректний email" });
      return null;
    }
    if (payload.password.length < 8 || !/[a-zа-яіїєґ]/i.test(payload.password) || !/\d/.test(payload.password)) {
      set({ authError: "Пароль має містити мінімум 8 символів, букви і цифри" });
      return null;
    }
    if (get().data.users.some((user) => user.email.toLowerCase() === payload.email.toLowerCase())) {
      set({ authError: "Email вже зареєстрований" });
      return null;
    }
    const user: User = {
      id: `user-${crypto.randomUUID()}`,
      name: payload.name,
      email: payload.email.toLowerCase(),
      role: "student",
      avatar: payload.name.slice(0, 2).toUpperCase(),
      level: "A0",
      goal: payload.goal,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      subscriptionStatus: "trial",
      trialEndsAt: new Date(Date.now() + 14 * 86400_000).toISOString(),
      onboardingDone: false,
      settings: { language: "uk", notificationsEnabled: true, soundEnabled: true, hapticsEnabled: true, dailyGoal: 10, theme: "default" }
    };
    const data: AppData = {
      ...get().data,
      users: [...get().data.users, user],
      progress: { ...get().data.progress, [user.id]: createProgress(user.id, "A0") },
      userWords: { ...get().data.userWords, [user.id]: [] }
    };
    save(data);
    localStorage.setItem(sessionKey, user.id);
    // Register on server so the session cookie is set for subsequent sync pushes.
    // Fire-and-forget — the mutation queue will re-sync any pending actions once
    // the user comes online.
    apiClient.register(user.id, user.name, payload.email, payload.password, user.goal).catch(() => undefined);
    set({ data, currentUserId: user.id, authError: undefined });
    return user;
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
      progress: { ...get().data.progress, [currentUserId]: { ...progress, currentLevel: level, currentLessonId } }
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
    const prevCompleted = get().data.progress[currentUserId].completedLessons;
    const subStatus = get().data.users.find((u) => u.id === currentUserId)?.subscriptionStatus;
    const progress = progressService.completeLesson(get().data.progress[currentUserId], lesson, answers, subStatus);
    const userWords = lesson.words.reduce<UserWord[]>((words, word) => progressService.touchWord(currentUserId, word.id, words, true), get().data.userWords[currentUserId] || []);
    let data: AppData = {
      ...get().data,
      progress: { ...get().data.progress, [currentUserId]: { ...progress, currentLessonId: nextLessonId(get().data.lessons, progress.completedLessons, progress.currentLevel) } },
      userWords: { ...get().data.userWords, [currentUserId]: userWords }
    };
    data = { ...data, leaderboard: leaderboardService.recalculate(data.leaderboard, data.users, data.progress) };
    data = withSync(data, "lesson.complete", { lessonId: lesson.id, answers });
    save(data);
    set({ data });
    // Request FCM permission after the user's very first lesson — unobtrusive timing
    if (!prevCompleted.includes(lesson.id) && prevCompleted.length === 0) {
      import("../services/fcmService").then(({ requestFcmToken }) => {
        requestFcmToken().then((token) => {
          if (token) apiClient.saveFcmToken(token).catch(() => undefined);
        }).catch(() => undefined);
      });
    }
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

export function roleHome(role: UserRole): string {
  if (role === "admin") return "/admin";
  if (role === "teacher") return "/teacher";
  return "/app/path";
}
