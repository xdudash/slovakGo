import { useAppStore, selectCurrentUser } from '../store/useAppStore';
import { isNativeApp } from './platform';
import { syncStudyReminders } from './nativeNotifications';
import { initNativeRemotePush, syncNativePush } from './nativeRemotePush';
import { initialLocale } from './localePreference';

// Serialize reschedules so a slow previous-account operation cannot win a race
// with logout, a new account, or a second change of reminder time.
export function initNativeNotificationSync(): void {
  if (!isNativeApp) return;
  const ready = initNativeRemotePush(() => useAppStore.getState().currentUserId);
  let pending = false;
  let running = false;
  const refresh = () => {
    pending = true;
    if (running) return;
    running = true;
    void (async () => {
      try {
        while (pending) {
          pending = false;
          const state = useAppStore.getState();
          const account = selectCurrentUser(state.data, state.currentUserId);
          const user = account ? { ...account, settings: { ...account.settings, language: initialLocale() } } : undefined;
          try {
            await syncStudyReminders(user, user ? state.data.progress[user.id]?.lastPracticeDate : undefined);
          } catch (error) {
            console.error('[native] reminders could not be updated', error);
            window.dispatchEvent(new Event('slovakgo:notification-sync-error'));
          }
          await ready;
          await syncNativePush(user).catch(error => console.error('[native] push could not be updated', error));
        }
      } finally { running = false; }
    })();
  };
  const fingerprint = (state: ReturnType<typeof useAppStore.getState>) => {
    const user = selectCurrentUser(state.data, state.currentUserId);
    return JSON.stringify([user?.id, user?.settings.language, user?.settings.notificationsEnabled, user?.settings.reminderTime,
      user ? state.data.progress[user.id]?.lastPracticeDate : undefined]);
  };
  useAppStore.subscribe((state, previous) => {
    if (fingerprint(state) !== fingerprint(previous)) refresh();
  });
  window.addEventListener('slovakgo:native-resume', refresh);
  window.addEventListener('slovakgo:notification-preferences', refresh);
  window.addEventListener('languagechange', refresh);
  refresh();
}
