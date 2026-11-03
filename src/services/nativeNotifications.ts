import { LocalNotifications } from '@capacitor/local-notifications';
import { isNativeApp } from './platform';
import { reminderPlan, REMINDER_ID, TEST_NOTIFICATION_ID } from './reminderPlan';
import { nativeCopy } from '../locales/native';
import type { Locale, User } from '../types';

export const remotePushConfigured = import.meta.env.VITE_NATIVE_PUSH_ENABLED === 'true';

export async function notificationPermission(): Promise<string> {
  return isNativeApp ? (await LocalNotifications.checkPermissions()).display : 'denied';
}

export async function requestNotificationPermission(): Promise<boolean> {
  const permission = await LocalNotifications.requestPermissions();
  return permission.display === 'granted';
}

export async function cancelStudyReminders(): Promise<void> {
  const { notifications } = await LocalNotifications.getPending();
  const owned = notifications.filter(n => n.id >= REMINDER_ID && n.id <= TEST_NOTIFICATION_ID);
  if (owned.length) await LocalNotifications.cancel({ notifications: owned.map(n => ({ id: n.id })) });
}

export async function syncStudyReminders(user: User | undefined, lastPracticeDate?: string): Promise<void> {
  if (!isNativeApp) return;
  await cancelStudyReminders();
  if (!user?.settings.notificationsEnabled || await notificationPermission() !== 'granted') return;
  const notifications = reminderPlan(user.id, user.settings.reminderTime || '19:00', user.settings.language, lastPracticeDate);
  if (notifications.length) await LocalNotifications.schedule({ notifications });
}

export async function testNativeNotification(language: Locale): Promise<void> {
  if (await notificationPermission() !== 'granted') throw new Error('Notifications are not allowed');
  const copy = nativeCopy[language];
  await LocalNotifications.schedule({ notifications: [{
    id: TEST_NOTIFICATION_ID, title: copy.testTitle, body: copy.testBody,
    schedule: { at: new Date(Date.now() + 5000) },
    extra: { kind: 'study-reminder', route: '/app/settings' },
  }] });
}

export async function openNotificationSettings(): Promise<void> {
  const { AppLauncher } = await import('@capacitor/app-launcher');
  await AppLauncher.openUrl({ url: 'app-settings:' });
}

export async function initNotificationNavigation(): Promise<void> {
  await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    // Never trust arbitrary notification URLs; only known in-app destinations.
    const route = action.notification.extra?.route === '/app/settings' ? '/app/settings' : '/app/path';
    window.dispatchEvent(new CustomEvent('slovakgo:native-route', { detail: route }));
  });
}
