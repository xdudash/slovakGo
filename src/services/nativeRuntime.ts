import { isNativeApp } from './platform';

/** Run once at startup. The web build does not load native plugins. */
export async function initNativeRuntime(onResume: () => void): Promise<void> {
  if (!isNativeApp) return;
  document.documentElement.classList.add('native-app');
  const updateTextSize = () => {
    document.documentElement.classList.toggle('native-large-text', parseFloat(getComputedStyle(document.documentElement).fontSize) > 22);
  };
  updateTextSize();
  window.addEventListener('resize', updateTextSize);
  const [{ App }, { Browser }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/browser'),
  ]);
  await App.addListener('resume', () => { updateTextSize(); onResume(); });

  const [{ Keyboard }, { StatusBar, Style }, { initNotificationNavigation }] = await Promise.all([
    import('@capacitor/keyboard'), import('@capacitor/status-bar'), import('./nativeNotifications'),
  ]);
  await StatusBar.setStyle({ style: Style.Default });
  await Keyboard.setAccessoryBarVisible({ isVisible: true });
  await Keyboard.addListener('keyboardWillShow', () => document.documentElement.classList.add('native-keyboard-open'));
  await Keyboard.addListener('keyboardWillHide', () => document.documentElement.classList.remove('native-keyboard-open'));
  await initNotificationNavigation();

  // Keep public/legal links out of the local app router and cookie session.
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || !(event.target instanceof Element)) return;
    const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
    if (!anchor || anchor.hasAttribute('download')) return;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin === window.location.origin || !['https:', 'http:'].includes(url.protocol)) return;
    event.preventDefault();
    void Browser.open({ url: url.href }).catch(() => undefined);
  });
}
