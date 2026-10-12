import { API_BASE_URL } from "./apiClient";
export const ACTIVE_WINDOW_MS = 60_000;
export const IDLE_SESSION_MS = 5 * 60_000;
/** Pure interval calculation: no hidden-tab or suspended-computer time is counted. */
export function activeInterval(from: number, to: number, lastInput: number, visible: boolean): number {
  if (!visible || to - from > 30_000) return 0;
  return Math.max(0, Math.min(to, lastInput + ACTIVE_WINDOW_MS) - from);
}
export function startActivityTracking(): () => void {
  let id = crypto.randomUUID();
  let lastInput = Date.now();
  let lastTick = lastInput;
  let activeMs = 0;
  let visits = 1;
  let closed = false;
  let idleFlushed = false;
  let hasInput = false;
  let visible = document.visibilityState === "visible" && document.hasFocus();
  const report = (ended = false, idle = false) => {
    const reportedId = id;
    void fetch(`${API_BASE_URL}/user/activity`, {
      method: "POST", credentials: "include", keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: id, activeSeconds: Math.floor(activeMs / 1000), visits, ended, idle }),
    }).then(r => r.ok ? r.json() : null).then(r => {
      if (r?.closed && id === reportedId) closed = true;
    }).catch(() => undefined);
  };
  const tick = () => {
    const now = Date.now();
    if (!closed) {
      activeMs += activeInterval(lastTick, now, lastInput, visible && hasInput);
      if (!idleFlushed && now - lastInput >= ACTIVE_WINDOW_MS) { report(false, true); idleFlushed = true; }
      if (now - lastInput >= IDLE_SESSION_MS) { report(true); closed = true; }
    }
    lastTick = now;
  };
  const input = () => {
    tick();
    if (closed) { id = crypto.randomUUID(); activeMs = 0; visits = 1; closed = false; report(); }
    lastInput = Date.now(); idleFlushed = false; hasInput = true;
  };
  const visibility = () => {
    tick();
    const nextVisible = document.visibilityState === "visible" && document.hasFocus();
    if (nextVisible === visible) return;
    visible = nextVisible;
    if (visible) { visits++; input(); } else if (!closed) report();
  };
  const end = () => { tick(); if (!closed) { report(true); closed = true; } };
  const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
  events.forEach(e => window.addEventListener(e, input, { passive: true }));
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("pagehide", end);
  window.addEventListener("focus", visibility);
  window.addEventListener("blur", visibility);
  report();
  const ticker = window.setInterval(tick, 5000);
  const heartbeat = window.setInterval(() => { tick(); if (!closed && visible && Date.now() - lastInput < ACTIVE_WINDOW_MS) report(); }, 20_000);
  return () => {
    end(); window.clearInterval(ticker); window.clearInterval(heartbeat);
    events.forEach(e => window.removeEventListener(e, input));
    document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", end);
    window.removeEventListener("focus", visibility); window.removeEventListener("blur", visibility);
  };
}
