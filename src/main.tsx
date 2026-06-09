import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import { syncService } from "./services/syncService";
import { useAppStore } from "./store/useAppStore";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>
);

function showInAppPush(title: string, body: string) {
  const el = document.createElement("div");
  el.className = "push-toast";
  el.innerHTML = `<strong>${title}</strong>${body ? `<em>${body}</em>` : ""}`;
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
  useAppStore.subscribe(
    (state) => state.data.syncQueue.length,
    (length) => {
      if (length > 0 && navigator.onLine) {
        useAppStore.getState().drainSync();
      }
    }
  );

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
        reg.sync?.register("sync-mutations").catch(() => undefined);
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
