import { getApps, getApp, initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, deleteToken } from 'firebase/messaging';

const FCM_SW_URL   = `${import.meta.env.BASE_URL}firebase-messaging-sw.js`;
const FCM_SW_SCOPE = `${import.meta.env.BASE_URL}fcm/`;
const VAPID_KEY    = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

const FCM_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY             as string | undefined,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN         as string | undefined,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID          as string | undefined,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET      as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID              as string | undefined,
};

function isConfigured(): boolean {
  return !!(FCM_CONFIG.apiKey && VAPID_KEY);
}

function app() {
  return getApps().length ? getApp() : initializeApp(FCM_CONFIG as Record<string, string>);
}

/**
 * Requests notification permission and returns the FCM token.
 * Registers firebase-messaging-sw.js at /fcm/ scope so it coexists with the main sw.js.
 * Returns null if Firebase is not configured or permission is denied.
 */
export async function requestFcmToken(): Promise<string | null> {
  if (!isConfigured() || !('Notification' in window) || !('serviceWorker' in navigator)) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    // Narrow scope keeps this SW from intercepting fetches while still receiving push events
    const swReg = await navigator.serviceWorker.register(FCM_SW_URL, { scope: FCM_SW_SCOPE });
    const token = await getToken(getMessaging(app()), { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
    return token || null;
  } catch {
    return null;
  }
}

/** Unsubscribes from push notifications (called when user disables notifications in settings). */
export async function revokeFcmToken(): Promise<void> {
  if (!isConfigured()) return;
  try {
    await deleteToken(getMessaging(app()));
  } catch { /* no-op */ }
}

/** Handles push messages when the app tab is open (foreground). */
export function listenForeground(handler: (title: string, body: string) => void): void {
  if (!isConfigured()) return;
  try {
    onMessage(getMessaging(app()), (payload) => {
      handler(payload.notification?.title || 'SlovakGO', payload.notification?.body || '');
    });
  } catch { /* Firebase not configured or messaging not supported */ }
}
