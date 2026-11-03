import type { LocalNotificationSchema } from '@capacitor/local-notifications';
import type { Locale } from '../types';
import { nativeCopy } from '../locales/native';

export const REMINDER_ID = 930000;
export const TEST_NOTIFICATION_ID = 930099;
export const REMINDER_DAYS = 30;

export function localDateKey(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function reminderPlan(userId: string, time: string, language: Locale, lastPracticeDate?: string, now = new Date()): LocalNotificationSchema[] {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return [];
  const [hour, minute] = time.split(':').map(Number);
  const copy = nativeCopy[language];
  const practiceDay = lastPracticeDate?.includes('T') ? localDateKey(new Date(lastPracticeDate)) : lastPracticeDate;
  const practicedToday = practiceDay === localDateKey(now);
  const notifications: LocalNotificationSchema[] = [];
  for (let day = 0; day < REMINDER_DAYS; day++) {
    const date = new Date(now);
    date.setDate(now.getDate() + day);
    date.setHours(hour, minute, 0, 0);
    if (date <= now || (day === 0 && practicedToday)) continue;
    notifications.push({
      id: REMINDER_ID + day, title: copy.reminderTitle, body: copy.reminderBody,
      // Calendar components follow the iPhone time zone, including DST changes.
      schedule: { on: { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), hour, minute, second: 0 } },
      extra: { kind: 'study-reminder', userId, route: '/app/path' },
    });
  }
  return notifications;
}
