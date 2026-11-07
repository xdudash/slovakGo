import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialLocale, preferredLocale } from './localePreference';
import { localDateKey, reminderPlan, REMINDER_DAYS, REMINDER_ID } from './reminderPlan';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('iPhone language preferences', () => {
  it('matches regional and ordered system language preferences', () => {
    expect(preferredLocale(['de-DE', 'sk-SK', 'en-GB'])).toBe('sk');
    expect(preferredLocale(['UK_ua', 'en-US'])).toBe('uk');
    expect(preferredLocale(['ru-KZ'])).toBe('ru');
    expect(preferredLocale(['de-DE'])).toBe('en');
  });
  it('preserves a manual language over system defaults', () => {
    vi.stubGlobal('localStorage', { getItem: () => 'sk' });
    expect(initialLocale()).toBe('sk');
  });
});

describe('native study reminders', () => {
  const now = new Date(2026, 9, 26, 12, 0);
  it('creates unique, localized calendar reminders below the iOS pending limit', () => {
    const plan = reminderPlan('learner-a', '19:30', 'ru', undefined, now);
    expect(plan).toHaveLength(REMINDER_DAYS);
    expect(new Set(plan.map(n => n.id)).size).toBe(REMINDER_DAYS);
    expect(plan[0]).toMatchObject({ id: REMINDER_ID, title: 'Время для словацкого', extra: { userId: 'learner-a' }, schedule: { on: { year: 2026, month: 10, day: 26, hour: 19, minute: 30 } } });
    expect(plan[0].schedule?.at).toBeUndefined();
  });
  it('skips today after practice but keeps future reminders', () => {
    const plan = reminderPlan('learner-a', '19:00', 'en', '2026-10-26', now);
    expect(plan).toHaveLength(REMINDER_DAYS - 1);
    expect(plan[0].schedule?.on?.day).toBe(27);
  });
  it('does not queue reminders that have already passed today', () => {
    const plan = reminderPlan('learner-a', '09:00', 'uk', undefined, now);
    expect(plan[0].schedule?.on?.day).toBe(27);
  });
  it('preserves local wall time over a daylight-saving transition', () => {
    vi.stubEnv('TZ', 'Europe/Bratislava');
    const plan = reminderPlan('learner-a', '19:30', 'en', undefined, new Date(2026, 9, 24, 12));
    expect(plan.slice(0, 3).map(n => n.schedule?.on)).toEqual([
      { year: 2026, month: 10, day: 24, hour: 19, minute: 30, second: 0 },
      { year: 2026, month: 10, day: 25, hour: 19, minute: 30, second: 0 },
      { year: 2026, month: 10, day: 26, hour: 19, minute: 30, second: 0 },
    ]);
  });
  it('treats timestamped practice as the device local date, not its UTC date', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
    const local = new Date(2026, 9, 26, 20);
    expect(localDateKey(local)).toBe('2026-10-26');
    const plan = reminderPlan('a', '23:00', 'en', '2026-10-27T02:00:00Z', local);
    expect(plan[0].schedule?.on?.day).toBe(27);
  });
  it.each(['', '25:00', '19:99', '9:00', 'no-time'])('rejects invalid reminder time %s', time => {
    expect(reminderPlan('a', time, 'en', undefined, now)).toEqual([]);
  });
});
