import { Capacitor } from '@capacitor/core';

export const isNativeApp = Capacitor.isNativePlatform();
export const PUBLIC_APP_ORIGIN = 'https://app.slovakgo.sk';

/** Leave the app's local WKWebView intact when opening hosted billing/support. */
export async function openExternalUrl(url: string): Promise<void> {
  const target = new URL(url);
  if (target.protocol !== 'https:') throw new Error('External links must use HTTPS.');
  if (isNativeApp) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: target.href });
  } else {
    window.location.href = target.href;
  }
}
