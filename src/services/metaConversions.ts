import { trackMeta, marketingAllowed } from "../../shared/metaPixel";
import { apiClient } from "./apiClient";
import { selectCurrentUser, useAppStore } from "../store/useAppStore";

export async function syncMetaBilling(sessionId?: string): Promise<void> {
  try {
    if (!marketingAllowed() || localStorage.getItem("slovakgo.admin-return")) return;
    const state = useAppStore.getState();
    const user = selectCurrentUser(state.data, state.currentUserId);
    if (user?.role !== "student") return;
    const { events } = await apiClient.billingConversions(sessionId);
    if (useAppStore.getState().currentUserId !== user.id) return;
    for (const event of events) trackMeta(event.name, event.params, event.id);
  } catch { /* Billing analytics must never affect paid access. */ }
}
