import type { Locale } from '../types';
import { isNativeApp } from './platform';

export const LOCALE_KEY = 'slovakgo.guest-lang';
export const supportedLocales = ['uk', 'ru', 'sk', 'en'] as const;

export function preferredLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const code = language.toLowerCase().split(/[-_]/)[0];
    if (supportedLocales.includes(code as Locale)) return code as Locale;
  }
  return 'en';
}

export function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_KEY);
    if (supportedLocales.includes(saved as Locale)) return saved as Locale;
  } catch { /* Device language still works with unavailable storage. */ }
  return isNativeApp && typeof navigator !== 'undefined'
    ? preferredLocale(navigator.languages?.length ? navigator.languages : [navigator.language])
    : 'uk';
}
