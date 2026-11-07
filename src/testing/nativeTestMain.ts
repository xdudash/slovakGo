/** Isolated Simulator fixture. Only used by Vite mode=native-test, never native. */
import { seedData } from '../data/seedData';
import { useAppStore } from '../store/useAppStore';

if (import.meta.env.MODE !== 'native-test') throw new Error('UI fixture cannot run in a normal build');
const data = structuredClone(seedData);
const user = data.users.find(user => user.id === 'user-student')!;
user.id = 'native-ui-fixture';
user.name = 'Alexandra Kovalenko';
user.subscriptionStatus = 'plus';
user.onboardingDone = true;
user.settings = { ...user.settings, language: 'en', notificationsEnabled: false, reminderTime: '19:00' };
data.progress[user.id] = { ...data.progress['user-student'], userId: user.id, lastPracticeDate: undefined };
data.userWords[user.id] = data.userWords['user-student'] ?? [];
data.users = [user];
localStorage.setItem('slovakgo.guest-lang', 'en');
localStorage.setItem('slovakgo.current-user', user.id);
useAppStore.setState({ data, currentUserId: user.id });
document.documentElement.dataset.uiTest = 'native-ui-fixture';
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, location.href);
  if (url.origin !== 'https://app.slovakgo.sk') return originalFetch(input, init);
  const state = useAppStore.getState();
  const current = state.data.users[0];
  const respond = (value: unknown) => Promise.resolve(new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } }));
  if (url.pathname === '/api/sync/pull') return respond({ user: current, progress: state.data.progress[current.id], userWords: state.data.userWords[current.id], lessons: state.data.lessons });
  if (url.pathname === '/api/lessons') return respond({ ok: true, unchanged: false, version: `published:${state.data.lessons.length}:native-ui-fixture`, lessons: state.data.lessons });
  if (url.pathname.startsWith('/api/lessons/')) return respond({ ok: true, lesson: state.data.lessons.find(l => l.id === decodeURIComponent(url.pathname.split('/').at(-1)!)) });
  if (url.pathname === '/api/sync/push') return respond({ ok: true, applied: JSON.parse(String(init?.body || '{}')).mutations?.length ?? 0 });
  if (url.pathname === '/api/user/email-preferences') return respond({ marketingConsent: false });
  if (url.pathname === '/api/leaderboard') return respond({ entries: state.data.leaderboard.entries });
  if (['/api/user/activity', '/api/events', '/api/errors', '/api/ping'].includes(url.pathname)) return respond({ ok: true, updatedAt: new Date().toISOString() });
  // Never fall through to a real production write during UI tests.
  return new Response(JSON.stringify({ error: 'Endpoint unavailable in isolated UI fixture' }), { status: 503 });
};
window.history.replaceState(null, '', '/app/path');
await import('../main');
