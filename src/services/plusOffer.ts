/**
 * The soft Plus offer is shown once at the end of onboarding. Learners who saw it
 * there skip the after-first-lesson offer, so nobody gets two offers in a row.
 */
const key = (userId: string) => `slovakgo.plus-offer-seen:${userId}`;

export function markPlusOfferSeen(userId: string): void {
  try { localStorage.setItem(key(userId), "1"); } catch { /* storage may be unavailable */ }
}

export function plusOfferSeen(userId: string): boolean {
  try { return localStorage.getItem(key(userId)) === "1"; } catch { return false; }
}

/** Only in-app destinations are accepted, so `next` can never send a learner off-site. */
export function safeNextPath(next: string | null, fallback = "/app/path"): string {
  return next && /^\/app\/[\w\-/]*$/.test(next) ? next : fallback;
}
