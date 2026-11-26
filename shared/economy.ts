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
}

export const FRAMES: readonly FrameDef[] = [
  { id: "simple", price: 0, rarity: "common" },
  { id: "lime", price: 60, rarity: "common" },
  { id: "violet", price: 150, rarity: "rare" },
  { id: "ice", price: 250, rarity: "rare" },
  { id: "gold", price: 400, rarity: "epic" },
  { id: "fire", price: 0, rarity: "legendary", plusOnly: true },
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
  return frame.price === 0 || owned.includes(frame.id);
}

export type ShopItem = "freeze" | `frame:${string}`;

/** Price of a purchasable item, or null when it cannot be bought with crowns. */
export function itemPrice(item: string): number | null {
  if (item === "freeze") return FREEZE_PRICE;
  if (item.startsWith("frame:")) {
    const frame = frameById(item.slice("frame:".length));
    return frame && !frame.plusOnly && frame.price > 0 ? frame.price : null;
  }
  return null;
}
