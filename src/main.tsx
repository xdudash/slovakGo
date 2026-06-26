import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { apiClient } from "./services/apiClient";
import { syncService } from "./services/syncService";
import { useAppStore } from "./store/useAppStore";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);

// Global error reporter — catches JS errors outside React tree (network errors, promise rejections, etc.)
// Throttled to max 1 report per 5 s to prevent flooding the server.
let _lastReportedAt = 0;
function reportGlobalError(message: string, stack?: string) {
  if (!message || import.meta.env.DEV) return; // skip in dev
  const now = Date.now();
  if (now - _lastReportedAt < 5000) return;
  _lastReportedAt = now;
  apiClient.reportError({ message, stack, url: window.location.href }).catch(() => undefined);
}

window.onerror = (_msg, _src, _line, _col, error) => {
  reportGlobalError(error?.message ?? String(_msg), error?.stack);
  return false; // don't suppress default browser logging
};

window.addEventListener("unhandledrejection", (event) => {
  const err = event.reason;
  const message = err instanceof Error ? err.message : String(err ?? "Unhandled rejection");
  reportGlobalError(message, err instanceof Error ? err.stack : undefined);
});

// PWA install lifecycle — registered at module level so beforeinstallprompt
// is never missed even if it fires before the "load" event completes.
// TODO: replace console.log calls with your analytics provider (Plausible, PostHog, Mixpanel…)
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

window.addEventListener("beforeinstallprompt", (e) => {
  const event = e as BeforeInstallPromptEvent;
  e.preventDefault(); // Prevent the default browser install banner
  (window as any).deferredPrompt = event;
  window.dispatchEvent(new CustomEvent("pwa-install-available"));
  // TODO: analytics.track("pwa_install_prompted", { platforms: event.platforms })
  console.log("[PWA] beforeinstallprompt — user eligible for install", { platforms: event.platforms });
});

window.addEventListener("appinstalled", () => {
  (window as any).deferredPrompt = null;
  window.dispatchEvent(new CustomEvent("pwa-install-available"));
  // TODO: analytics.track("pwa_installed")
  console.log("[PWA] appinstalled — user installed the PWA");
});

function showInAppPush(title: string, body: string) {
  const el = document.createElement("div");
  el.className = "push-toast";
  const strong = document.createElement("strong");
  strong.textContent = title;
  el.appendChild(strong);
  if (body) {
    const em = document.createElement("em");
    em.textContent = body;
    el.appendChild(em);
  }
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

window.addEventListener("load", async () => {
  // Foreground push notification handler (when app is open in browser)
  import("./services/fcmService").then(({ listenForeground }) => {
    listenForeground(showInAppPush);
  });

  const store = useAppStore.getState();

  // Recover any mutations written to IDB in previous sessions but lost from in-memory queue
  const orphaned = await syncService.recover(store.data.syncQueue);
  if (orphaned.length > 0) {
    useAppStore.setState((state) => ({
      data: { ...state.data, syncQueue: [...state.data.syncQueue, ...orphaned] }
    }));
  }

  // Drain immediately after queue mutations are added while online
  useAppStore.subscribe((state, prev) => {
    if (state.data.syncQueue.length > prev.data.syncQueue.length && navigator.onLine) {
      useAppStore.getState().drainSync();
    }
  });

  // Drain when user returns to the tab
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && navigator.onLine) {
      useAppStore.getState().drainSync();
    }
  });

  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    try {
      // Snapshot before registration — if already controlled, a later controllerchange is an update
      const hadController = !!navigator.serviceWorker.controller;

      const reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);

      // Reload only on SW update (not on first install)
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (hadController) window.location.reload();
      });

      // SW background sync fires SYNC_REQUESTED → drain queue
      navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {
        if ((event.data as { type?: string })?.type === "SYNC_REQUESTED") {
          useAppStore.getState().drainSync();
        }
      });

      // Show update banner when a new SW is waiting (installed but not yet active)
      function showUpdateBanner(registration: ServiceWorkerRegistration) {
        if (document.querySelector(".sw-update-banner")) return; // already shown
        const banner = document.createElement("div");
        banner.className = "sw-update-banner";
        banner.innerHTML =
          '<span>Нова версія доступна</span>' +
          '<button class="sw-update-btn">Оновити</button>';
        (banner.querySelector(".sw-update-btn") as HTMLButtonElement).onclick = () => {
          registration.waiting?.postMessage("SKIP_WAITING");
          banner.remove();
        };
        document.body.appendChild(banner);
      }

      // A new SW may already be waiting right after registration (e.g. page reload during update)
      if (reg.waiting) showUpdateBanner(reg);

      // Watch for future updates found while the page is open
      reg.addEventListener("updatefound", () => {
        const next = reg.installing;
        if (!next) return;
        next.addEventListener("statechange", () => {
          if (next.state === "installed" && reg.waiting) {
            showUpdateBanner(reg);
          }
        });
      });

      // Coming back online: register BG sync tag + drain directly as fallback
      window.addEventListener("online", () => {
        (reg as unknown as { sync?: { register: (tag: string) => Promise<void> } }).sync?.register("sync-mutations").catch(() => undefined);
        useAppStore.getState().drainSync();
      });
    } catch {
      // SW registration failed — non-fatal, direct online listener is enough
      window.addEventListener("online", () => {
        useAppStore.getState().drainSync();
      });
    }
  } else {
    // Dev mode: still drain on reconnect
    window.addEventListener("online", () => {
      useAppStore.getState().drainSync();
    });
  }
});
