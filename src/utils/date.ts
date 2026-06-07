export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): string {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

export function isYesterday(dateIso?: string): boolean {
  if (!dateIso) return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return todayKey(new Date(dateIso)) === todayKey(yesterday);
}

export function isToday(dateIso?: string): boolean {
  return !!dateIso && todayKey(new Date(dateIso)) === todayKey();
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
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 1 - day);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
