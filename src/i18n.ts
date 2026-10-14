import { useSyncExternalStore } from "react";
import ukData from './locales/uk.json';
import ruData from './locales/ru.json';
import skData from './locales/sk.json';
import enData from './locales/en.json';
import { useAppStore } from './store/useAppStore';
import type { Locale } from './types';

export type { Locale };

const locales: Record<Locale, Record<string, unknown>> = {
  uk: ukData as Record<string, unknown>,
  ru: ruData as Record<string, unknown>,
  sk: skData as Record<string, unknown>,
  en: enData as Record<string, unknown>,
};

function dig(dict: Record<string, unknown>, key: string): unknown {
  const parts = key.split('.');
  let v: unknown = dict;
  for (const k of parts) v = (v as Record<string, unknown>)?.[k];
  return v;
}

let guestLanguageFallback: Locale = "uk";

export function getGuestLanguage(): Locale {
  let saved: string | null = null;
  try { saved = localStorage.getItem('slovakgo.guest-lang'); } catch { /* Use the default language when storage is unavailable. */ }
  if (saved && (saved === 'uk' || saved === 'ru' || saved === 'sk' || saved === 'en')) {
    return saved as Locale;
  }
  return guestLanguageFallback;
}

export function setGuestLanguage(lang: Locale) {
  guestLanguageFallback = lang;
  try { localStorage.setItem('slovakgo.guest-lang', lang); } catch { /* Language changes should not crash a private browser. */ }
  document.documentElement.lang = lang;
  window.dispatchEvent(new Event('languagechange'));
}

if (typeof document !== 'undefined') {
  const requestedLanguage = new URLSearchParams(window.location.search).get('lang');
  if (requestedLanguage && ['uk', 'ru', 'en', 'sk'].includes(requestedLanguage)) {
    try { localStorage.setItem('slovakgo.guest-lang', requestedLanguage); } catch { /* Storage may be disabled. */ }
  }
  document.documentElement.lang = getGuestLanguage();
}

function subscribeGuestLanguage(onChange: () => void) {
  window.addEventListener("languagechange", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("languagechange", onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useT() {
  const guestLanguage = useSyncExternalStore(subscribeGuestLanguage, getGuestLanguage, () => "uk" as Locale);
  const userLanguage = useAppStore((s) => s.data.users.find((u) => u.id === s.currentUserId)?.settings?.language);
  const lang = (userLanguage ?? guestLanguage) as Locale;

  const dict = locales[lang] ?? locales.uk;
  const fallback = locales.uk;

  function t(key: string): string {
    const v = dig(dict, key);
    if (typeof v === 'string' && v !== '') return v;
    const fb = dig(fallback, key);
    return typeof fb === 'string' ? fb : key;
  }

  function ta(key: string): string[] {
    const v = dig(dict, key);
    if (Array.isArray(v) && (v as unknown[]).length > 0) return v as string[];
    const fb = dig(fallback, key);
    return Array.isArray(fb) ? (fb as string[]) : [];
  }

  return { t, ta, lang };
}

