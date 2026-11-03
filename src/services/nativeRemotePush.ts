import { isNativeApp } from './platform';
import { notificationPermission, remotePushConfigured } from './nativeNotifications';
import { apiClient } from './apiClient';
import type { User } from '../types';

let owner: string | undefined;
let token: string | undefined;
let listening = false;
let currentUserId: () => string | undefined = () => undefined;
const environment = import.meta.env.VITE_NATIVE_PUSH_ENVIRONMENT === 'production' ? 'production' : 'sandbox';

export async function initNativeRemotePush(getUserId: () => string | undefined): Promise<void> {
  if (!isNativeApp || !remotePushConfigured || listening) return;
  currentUserId = getUserId;
  const { PushNotifications } = await import('@capacitor/push-notifications');
  await PushNotifications.addListener('registration', registration => {
    const expectedOwner = owner;
    if (!expectedOwner || currentUserId() !== expectedOwner) return;
    token = registration.value;
    void apiClient.saveNativePushToken(token, environment, true).catch(error => {
      console.error('[native] push token could not be registered', error);
      owner = undefined;
    });
  });
  await PushNotifications.addListener('registrationError', error => {
    console.error('[native] APNs registration failed', error);
    owner = undefined;
  });
  await PushNotifications.addListener('pushNotificationActionPerformed', () => {
    window.dispatchEvent(new CustomEvent('slovakgo:native-route', { detail: '/app/path' }));
  });
  listening = true;
}

export async function disconnectNativePush(): Promise<void> {
  if (!isNativeApp || !remotePushConfigured) return;
  owner = undefined;
  const oldToken = token;
  token = undefined;
  const { PushNotifications } = await import('@capacitor/push-notifications');
  await Promise.allSettled([
    oldToken ? apiClient.saveNativePushToken(oldToken, environment, false) : Promise.resolve(),
    PushNotifications.unregister(),
  ]);
}

export async function syncNativePush(user: User | undefined): Promise<void> {
  if (!isNativeApp || !remotePushConfigured) return;
  if (!user?.settings.notificationsEnabled || await notificationPermission() !== 'granted') {
    await disconnectNativePush();
    return;
  }
  if (owner === user.id) return;
  owner = user.id;
  const { PushNotifications } = await import('@capacitor/push-notifications');
  await PushNotifications.register();
}
