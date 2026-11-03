import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';

const native = vi.hoisted(() => ({
  checkPermissions: vi.fn(), requestPermissions: vi.fn(), getPending: vi.fn(), cancel: vi.fn(), schedule: vi.fn(),
}));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: native }));
vi.mock('./platform', () => ({ isNativeApp: true }));
import { syncStudyReminders } from './nativeNotifications';

const user = { id: 'a', settings: { notificationsEnabled: true, language: 'en', reminderTime: '19:00' } } as User;
beforeEach(() => {
  vi.resetAllMocks();
  native.checkPermissions.mockResolvedValue({ display: 'granted' });
  native.getPending.mockResolvedValue({ notifications: [{ id: 930000 }, { id: 930099 }, { id: 42 }] });
  native.cancel.mockResolvedValue(undefined);
  native.schedule.mockResolvedValue(undefined);
});

describe('native permission and account lifecycle', () => {
  it('does not prompt on startup and cancels owned reminders when permission was revoked', async () => {
    native.checkPermissions.mockResolvedValue({ display: 'denied' });
    await syncStudyReminders(user);
    expect(native.requestPermissions).not.toHaveBeenCalled();
    expect(native.schedule).not.toHaveBeenCalled();
    expect(native.cancel).toHaveBeenCalledWith({ notifications: [{ id: 930000 }, { id: 930099 }] });
  });
  it('cleans up reminders on logout without cancelling unrelated notifications', async () => {
    await syncStudyReminders(undefined);
    expect(native.schedule).not.toHaveBeenCalled();
    expect(native.cancel).toHaveBeenCalledWith({ notifications: [{ id: 930000 }, { id: 930099 }] });
  });
  it('does not schedule when reminders are disabled in the account', async () => {
    await syncStudyReminders({ ...user, settings: { ...user.settings, notificationsEnabled: false } });
    expect(native.schedule).not.toHaveBeenCalled();
  });
  it('replaces a previous account’s reminders with the current account and language', async () => {
    await syncStudyReminders(user);
    await syncStudyReminders({ ...user, id: 'b', settings: { ...user.settings, language: 'sk' } });
    const plan = native.schedule.mock.calls.at(-1)![0].notifications;
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.every((n: { extra: { userId: string }; title: string }) => n.extra.userId === 'b' && n.title === 'Čas na slovenčinu')).toBe(true);
  });
});
