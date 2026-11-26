/**
 * When to show the reminder primer (iOS): after the first finished lesson, and
 * once more after the third lesson if the learner tapped "Not now" the first time.
 */
type PrimeState = "dismissed" | "done";
const key = (userId: string) => `slovakgo.reminder-prime:${userId}`;

export function markReminderPrime(userId: string, state: PrimeState): void {
  try { localStorage.setItem(key(userId), state); } catch { /* storage may be unavailable */ }
}

export function reminderPrimeState(userId: string): PrimeState | null {
  try {
    const value = localStorage.getItem(key(userId));
    return value === "dismissed" || value === "done" ? value : null;
  } catch { return null; }
}

export function shouldPrimeReminders(userId: string, completedLessons: number): boolean {
  const state = reminderPrimeState(userId);
  if (state === null) return completedLessons >= 1;
  return state === "dismissed" && completedLessons >= 3;
}
