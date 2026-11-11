/** Isolated Simulator fixture. Only used by Vite mode=native-test, never native. */
import { seedData } from '../data/seedData';
import { useAppStore } from '../store/useAppStore';

if (import.meta.env.MODE !== 'native-test') throw new Error('UI fixture cannot run in a normal build');
const data = structuredClone(seedData);
const user = data.users.find(user => user.id === 'user-student')!;
user.id = 'native-ui-fixture';
user.name = 'Alexandra Kovalenko';
// VITE_FIXTURE_FLOW=onboarding: a brand-new free learner, to walk the first-run flow.
const flow = import.meta.env.VITE_FIXTURE_FLOW;
const firstRun = flow === 'onboarding' || flow === 'first-lesson';
// first-lesson: the Plus offer a free learner sees after finishing lesson one.
user.subscriptionStatus = firstRun ? 'free' : 'plus';
user.onboardingDone = flow !== 'onboarding';
user.settings = { ...user.settings, language: 'en', notificationsEnabled: false, reminderTime: '19:00' };
data.progress[user.id] = { ...data.progress['user-student'], userId: user.id, lastPracticeDate: undefined };
if (firstRun) data.progress[user.id] = { ...data.progress[user.id], completedLessons: [], xpDailyHistory: {}, streakDays: 0 };
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
  if (url.pathname === '/api/billing/apple/account') return respond({ appAccountToken: '00000000-0000-4000-8000-000000000000', productIds: ['sk.slovakgo.plus.monthly', 'sk.slovakgo.plus.yearly'] });
  if (url.pathname === '/api/user/email-preferences') return respond({ marketingConsent: false });
  if (url.pathname === '/api/leaderboard') return respond({ entries: state.data.leaderboard.entries });
  if (['/api/user/activity', '/api/events', '/api/errors', '/api/ping'].includes(url.pathname)) return respond({ ok: true, updatedAt: new Date().toISOString() });
  // Never fall through to a real production write during UI tests.
  return new Response(JSON.stringify({ error: 'Endpoint unavailable in isolated UI fixture' }), { status: 503 });
};
// StoreKit has no products in a CLI-launched Simulator, so serve the real price points.
const cap = (window as unknown as { Capacitor?: { nativePromise: (plugin: string, method: string, options?: unknown) => Promise<unknown> } }).Capacitor;
if (cap) {
  const nativePromise = cap.nativePromise.bind(cap);
  const trial = { paymentMode: 'freeTrial', displayPrice: '0,00 €', period: { unit: 'day', value: 3 }, periodCount: 1 };
  cap.nativePromise = (plugin, method, options) => plugin === 'SlovakGoStore' && method === 'getProducts'
    ? Promise.resolve({ products: [
      { id: 'sk.slovakgo.plus.monthly', displayName: 'Plus', displayPrice: '3,99 €', price: 3.99, currencyCode: 'EUR', period: { unit: 'month', value: 1 }, introOffer: trial },
      { id: 'sk.slovakgo.plus.yearly', displayName: 'Plus', displayPrice: '29,99 €', price: 29.99, currencyCode: 'EUR', period: { unit: 'year', value: 1 }, introOffer: trial },
    ] })
    : nativePromise(plugin, method, options);
}
window.history.replaceState(null, '', flow === 'onboarding' ? '/onboarding' : flow === 'first-lesson' ? '/app/plus?from=first-lesson' : '/app/path');
await import('../main');
