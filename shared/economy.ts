import { shiftLearningDay } from "./learningCalendar";

/**
 * Crowns ("корони"): the in-app currency, earned only by learning and spent on
 * cosmetics and streak freezes. It is never sold for money, so it stays outside
 * In-App Purchase rules. The server is authoritative; the client mirrors these
 * numbers for its optimistic update.
 */
export const CROWNS = {
  /** First completion of a lesson. */
  lesson: 10,
  /** Extra for a first completion with no wrong answers. */
  perfect: 10,
  /** Repeating an already finished lesson. */
  repeat: 2,
  /** First lesson or practice of a new learning day. */
  streakDay: 5,
  /** A finished practice session. */
  practice: 3,
} as const;

/** Plus learners earn half as much again, like their XP bonus. */
const PLUS_MULTIPLIER = 1.5;

export const FREEZE_PRICE = 50;
export const MAX_FREEZES = 2;

export type FrameRarity = "common" | "rare" | "epic" | "legendary";
export interface FrameDef {
  id: string;
  price: number;
  rarity: FrameRarity;
  /** Unlocked by an active Plus subscription instead of crowns. */
  plusOnly?: boolean;
  /** Earned by an achievement instead of crowns. */
  unlock?: "streak30";
}



export const FRAMES: readonly FrameDef[] = [
  { id: "simple", price: 0, rarity: "common" },
  { id: "lime", price: 60, rarity: "common" },
  { id: "violet", price: 150, rarity: "rare" },
  { id: "ice", price: 250, rarity: "rare" },
  { id: "gold", price: 400, rarity: "epic" },
  { id: "fire", price: 0, rarity: "legendary", plusOnly: true },
  /** Earned by a 30-day streak; never sold. */
  { id: "comet", price: 0, rarity: "legendary", unlock: "streak30" },
];

export const frameById = (id: string | null | undefined): FrameDef | undefined =>
  FRAMES.find((frame) => frame.id === id);

const hasPlus = (status: string | null | undefined) => status === "plus" || status === "trial" || status === "past_due";

export function lessonCrowns(opts: { firstTime: boolean; perfect: boolean; newDay: boolean; status?: string | null }): number {
  const base = (opts.firstTime ? CROWNS.lesson + (opts.perfect ? CROWNS.perfect : 0) : CROWNS.repeat)
    + (opts.newDay ? CROWNS.streakDay : 0);
  return hasPlus(opts.status) ? Math.round(base * PLUS_MULTIPLIER) : base;
}

export function practiceCrowns(opts: { newDay: boolean; status?: string | null }): number {
  const base = CROWNS.practice + (opts.newDay ? CROWNS.streakDay : 0);
  return hasPlus(opts.status) ? Math.round(base * PLUS_MULTIPLIER) : base;
}

/** A lesson is perfect when every answer was right on the first try. */
export function isPerfectRun(answers: ReadonlyArray<{ correct?: unknown }>): boolean {
  return answers.length > 0 && answers.every((answer) => answer?.correct === true);
}

/** Whether `frameId` may be worn: free, bought, or Plus-only with Plus. */
export function canWearFrame(frameId: string, owned: readonly string[], status?: string | null): boolean {
  const frame = frameById(frameId);
  if (!frame) return false;
  if (frame.plusOnly) return hasPlus(status);
  if (frame.unlock) return owned.includes(frame.id);
  return frame.price === 0 || owned.includes(frame.id);
}

export type ShopItem = "freeze" | `frame:${string}`;

/** A streak still counts while the last session was today or yesterday. */
export function liveStreak(streakDays: number, lastPracticeDay: string | null | undefined, today: string): number {
  const last = String(lastPracticeDay ?? "").slice(0, 10);
  return last && (last === today || last === shiftLearningDay(today, -1)) ? streakDays : 0;
}

/** Shop discount for keeping a streak: 10% from 3 days, 20% from 7. */
export function streakDiscount(streak: number): number {
  return streak >= 7 ? 20 : streak >= 3 ? 10 : 0;
}

/** Price of a purchasable item, or null when it cannot be bought with crowns. */
export function itemPrice(item: string, streak = 0): number | null {
  let base: number | null = null;
  if (item === "freeze") base = FREEZE_PRICE;
  else if (item.startsWith("frame:")) {
    const frame = frameById(item.slice("frame:".length));
    base = frame && !frame.plusOnly && !frame.unlock && frame.price > 0 ? frame.price : null;
  }
  return base === null ? null : Math.round(base * (100 - streakDiscount(streak)) / 100);
}

// ─── Streak milestones ──────────────────────────────────────────────────────

export const STREAK_MILESTONES: Readonly<Record<number, number>> = { 3: 20, 7: 50, 14: 100, 30: 200 };

/** The milestone crossed when a streak grows from `before` to `after`, if any. */
export function streakMilestone(before: number, after: number): { days: number; crowns: number } | null {
  if (after <= before) return null;
  const crowns = STREAK_MILESTONES[after];
  return crowns ? { days: after, crowns } : null;
}

// ─── Daily chest ────────────────────────────────────────────────────────────

/** Today's activity, reset on a new learning day. */
export interface DailyState { day: string; lessons: number; practices: number; claimed: boolean }
export const DAILY_XP_GOAL = 30;

export function dailyFor(state: Partial<DailyState> | null | undefined, today: string): DailyState {
  return state && state.day === today
    ? { day: today, lessons: Number(state.lessons ?? 0), practices: Number(state.practices ?? 0), claimed: Boolean(state.claimed) }
    : { day: today, lessons: 0, practices: 0, claimed: false };
}

export function chestTasks(daily: DailyState, xpToday: number): { lesson: boolean; practice: boolean; xp: boolean } {
  return { lesson: daily.lessons >= 1, practice: daily.practices >= 1, xp: xpToday >= DAILY_XP_GOAL };
}

export function chestReady(daily: DailyState, xpToday: number): boolean {
  const tasks = chestTasks(daily, xpToday);
  return !daily.claimed && tasks.lesson && tasks.practice && tasks.xp;
}

/** 20–40 crowns, the same for a learner all day so the app and server agree. */
export function chestReward(userId: string, day: string): number {
  let h = 2166136261;
  for (const ch of `${userId}:${day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return 20 + ((h >>> 0) % 21);
}

// ─── Weekly league and referrals ────────────────────────────────────────────

/** Crowns for places 1–3 of a finished week. */
export const LEAGUE_REWARDS = [100, 60, 30] as const;
/** Crowns for the inviter once an invited friend finishes a first lesson. */
export const REFERRAL_CROWNS = 100;
/** At most this many invited friends pay crowns to one inviter. */
export const MAX_REFERRAL_PAYOUTS = 5;
