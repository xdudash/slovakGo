import { useEffect, useState } from 'react';
import { Bell, Check, ExternalLink } from 'lucide-react';
import { useT } from '../i18n';
import { nativeCopy } from '../locales/native';
import { Button, Card } from './ui';
import type { User, UserSettings } from '../types';
import { notificationPermission, openNotificationSettings, remotePushConfigured, requestNotificationPermission, testNativeNotification } from '../services/nativeNotifications';

export function NativeNotificationSettings({ user, onChange }: { user: User; onChange: (patch: Partial<UserSettings>) => void }) {
  const { t, lang } = useT();
  const copy = nativeCopy[lang];
  const [permission, setPermission] = useState<string>('prompt');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = () => { void notificationPermission().then(value => { if (active) setPermission(value); }).catch(() => { if (active) setError(copy.notificationError); }); };
    refresh();
    const syncError = () => setError(copy.notificationError);
    window.addEventListener('slovakgo:native-resume', refresh);
    window.addEventListener('slovakgo:notification-sync-error', syncError);
    return () => { active = false; window.removeEventListener('slovakgo:native-resume', refresh); window.removeEventListener('slovakgo:notification-sync-error', syncError); };
  }, [copy.notificationError]);
  const enabled = permission === 'granted' && user.settings.notificationsEnabled;

  async function toggle(enabled: boolean) {
    setBusy(true); setError(''); setMessage('');
    try {
      if (!enabled) { onChange({ notificationsEnabled: false }); return; }
      const allowed = await requestNotificationPermission();
      setPermission(allowed ? 'granted' : 'denied');
      onChange({ notificationsEnabled: allowed, reminderTime: user.settings.reminderTime || '19:00' });
      window.dispatchEvent(new Event('slovakgo:notification-preferences'));
    } catch { setError(copy.notificationError); }
    finally { setBusy(false); }
  }

  return <section className="settings-section native-notification-settings">
    <h3 className="settings-section-title">{t('student.settings.section_notifications')}</h3>
    <Card className="native-settings-group">
      <label className="toggle-row">
        <span className="native-setting-label"><Bell size={20} aria-hidden="true" />{t('student.settings.notifications')}</span>
        <input type="checkbox" role="switch" checked={enabled} disabled={busy} onChange={event => void toggle(event.target.checked)} />
      </label>
      <p className="native-setting-note">{permission === 'denied' ? copy.permissionDenied : enabled ? copy.permissionReady : copy.permissionOff}</p>
      {permission === 'denied' && <Button variant="ghost" onClick={() => void openNotificationSettings().catch(() => setError(copy.notificationError))}>
        {copy.openSettings}<ExternalLink size={16} aria-hidden="true" />
      </Button>}
      {enabled && <>
        <label className="native-setting-row" htmlFor="native-reminder-time">
          <span>{t('student.settings.reminder_label')}</span>
          <input id="native-reminder-time" type="time" value={user.settings.reminderTime || '19:00'} onChange={event => {
            if (!event.target.value) return;
            onChange({ reminderTime: event.target.value });
          }} />
        </label>
        <p className="native-setting-note">{copy.reminderHint}</p>
        <Button variant="secondary" disabled={busy} onClick={async () => {
          setBusy(true); setError(''); setMessage('');
          try { await testNativeNotification(lang); setMessage(copy.testScheduled); }
          catch { setError(copy.notificationError); }
          finally { setBusy(false); }
        }}>{copy.testNotification}</Button>
      </>}
      <div className="native-setting-info">
        <strong>{copy.pushLabel}</strong>
        <p className="native-setting-note">{remotePushConfigured ? copy.pushReady : copy.pushPending}</p>
      </div>
      {message && <p className="native-setting-status" role="status"><Check size={18} aria-hidden="true" />{message}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </Card>
  </section>;
}
