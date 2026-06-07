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
  const orphaned = await syncService.recover(store.data.syncQueue);
  if (orphaned.length > 0) {
    useAppStore.setState((state) => ({
      data: { ...state.data, syncQueue: [...state.data.syncQueue, ...orphaned] }
    }));
  }

  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    try {
      const reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });

      navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {
        if ((event.data as { type?: string })?.type === "SYNC_REQUESTED") {
          useAppStore.getState().drainSync();
        }
      });

      window.addEventListener("online", () => {
        reg.sync?.register("sync-mutations").catch(() => undefined);
        useAppStore.getState().drainSync();
      });
    } catch {
      // SW registration failed — non-fatal
    }
  }
});
