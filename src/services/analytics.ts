/**
 * Funnel tracking.
 *
 * The single number that caps revenue is how many registered learners reach the
 * end of the first section, and until now nothing measured it. Events are
 * buffered and flushed together so a lesson never waits on a network call.
 *
 * Server-side counterparts (trial_start, paid, churn) are written directly from
 * the Stripe webhook — they must not depend on the browser being open.
 */

export type FunnelEvent =
  | "register"
  | "onboarding_done"
  | "placement_test_done"
  | "lesson_start"
  | "lesson_complete"
  | "section_complete"
  | "paywall_view"
  | "checkout_start"
  | "notifications_enabled";

import { API_BASE_URL } from "./apiClient";

interface QueuedEvent {
  name: FunnelEvent;
  props: Record<string, unknown>;
}

const FLUSH_DELAY_MS = 3000;

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function send(events: QueuedEvent[], useBeacon: boolean): void {
  if (!events.length) return;
  const url = `${API_BASE_URL}/events`;
  const payload = JSON.stringify({ events });

  // On pagehide only sendBeacon is guaranteed to survive the unload.
  if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
    return;
  }
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    keepalive: true,
    body: payload,
  }).catch(() => undefined);
}

export function flush(useBeacon = false): void {
  if (timer) { clearTimeout(timer); timer = null; }
  const batch = queue;
  queue = [];
  send(batch, useBeacon);
}

/** Fire-and-forget. Never throws and never blocks the caller. */
export function track(name: FunnelEvent, props: Record<string, unknown> = {}): void {
  try {
    queue.push({ name, props });
    if (timer) return;
    timer = setTimeout(() => flush(), FLUSH_DELAY_MS);
  } catch { /* analytics must never break the app */ }
}

/** Call once at startup so buffered events are not lost when the tab closes. */
export function initAnalytics(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("pagehide", () => flush(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
}
