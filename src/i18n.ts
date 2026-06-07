import ukData from './locales/uk.json';
import skData from './locales/sk.json';
import enData from './locales/en.json';
import { useAppStore } from './store/useAppStore';

type Locale = 'uk' | 'sk' | 'en';

const locales: Record<Locale, Record<string, unknown>> = {
  uk: ukData as Record<string, unknown>,
  sk: skData as Record<string, unknown>,
  en: enData as Record<string, unknown>,
};

function dig(dict: Record<string, unknown>, key: string): unknown {
  const parts = key.split('.');
  let v: unknown = dict;
  for (const k of parts) v = (v as Record<string, unknown>)?.[k];
  return v;
}

export function useT() {
  const lang = useAppStore((s) => {
    const user = s.data.users.find((u) => u.id === s.currentUserId);
    return (user?.settings?.language ?? 'uk') as Locale;
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

  return { t, ta };
}
