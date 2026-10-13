import { learningDay, learningWeek, shiftLearningDay } from "../../shared/learningCalendar";

export function todayKey(date = new Date()): string {
  return learningDay(date);
}

export function addDays(date: Date, days: number): string {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

function dateDay(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayKey(new Date(value));
}

export function isYesterday(dateIso?: string): boolean {
  return !!dateIso && dateDay(dateIso) === shiftLearningDay(todayKey(), -1);
}

export function isToday(dateIso?: string): boolean {
  return !!dateIso && dateDay(dateIso) === todayKey();
}

export function secondsUntilWeekEnd(now = new Date()): number {
  const end = new Date(now);
  const day = end.getDay() || 7;
  end.setDate(end.getDate() + (7 - day));
  end.setHours(23, 59, 59, 999);
  return Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
}

export function formatWeekTimer(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days} д ${hours} год ${minutes} хв`;
}

export function currentWeekId(now = new Date()): string {
  return learningWeek(now);
}
