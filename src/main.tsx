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

window.addEventListener("load", async () => {
  const store = useAppStore.getState();

  // Recover any mutations left in IDB from previous sessions
  const orphaned = await syncService.recover(store.data.syncQueue);
  if (orphaned.length > 0) {
    useAppStore.setState((state) => ({
      data: { ...state.data, syncQueue: [...state.data.syncQueue, ...orphaned] }
    }));
  }

  // Auto-drain: whenever the queue grows while online, push immediately
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
      const reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });

      // SW background sync fires SYNC_REQUESTED → drain
      navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {
        if ((event.data as { type?: string })?.type === "SYNC_REQUESTED") {
          useAppStore.getState().drainSync();
        }
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
