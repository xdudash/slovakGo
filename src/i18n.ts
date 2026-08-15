import ukData from './locales/uk.json';
import ruData from './locales/ru.json';
import skData from './locales/sk.json';
import enData from './locales/en.json';
import { useAppStore } from './store/useAppStore';

type Locale = 'uk' | 'ru' | 'sk' | 'en';

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

export function getGuestLanguage(): Locale {
  const saved = localStorage.getItem('slovakgo.guest-lang');
  if (saved && (saved === 'uk' || saved === 'ru' || saved === 'sk' || saved === 'en')) {
    return saved as Locale;
  }
  return 'uk';
}

export function setGuestLanguage(lang: Locale) {
  localStorage.setItem('slovakgo.guest-lang', lang);
  document.documentElement.lang = lang;
  window.dispatchEvent(new Event('languagechange'));
}

if (typeof document !== 'undefined') {
  document.documentElement.lang = getGuestLanguage();
}

export function useT() {
  const lang = useAppStore((s) => {
    const user = s.data.users.find((u) => u.id === s.currentUserId);
    if (user?.settings?.language) return user.settings.language as Locale;
    return getGuestLanguage();
  });

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

