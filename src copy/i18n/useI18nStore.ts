import { create } from 'zustand';
import { Locale, Translations } from './types';
import { vi } from './locales/vi';
import { en } from './locales/en';

interface I18nState {
  locale: Locale;
  t: Translations;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

const STORAGE_KEY = 'hr-connect-lang';

const getInitialLocale = (): Locale => {
  if (typeof window === 'undefined') return 'vi';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'vi' || saved === 'en') {
      return saved;
    }
  } catch {
    // ignore
  }
  return 'vi';
};

const dictionaries: Record<Locale, Translations> = {
  vi,
  en,
};

export const useI18nStore = create<I18nState>((set, get) => {
  const initialLocale = getInitialLocale();

  return {
    locale: initialLocale,
    t: dictionaries[initialLocale],
    setLocale: (newLocale: Locale) => {
      try {
        localStorage.setItem(STORAGE_KEY, newLocale);
      } catch {
        // ignore
      }
      set({
        locale: newLocale,
        t: dictionaries[newLocale],
      });
    },
    toggleLocale: () => {
      const current = get().locale;
      const next: Locale = current === 'vi' ? 'en' : 'vi';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      set({
        locale: next,
        t: dictionaries[next],
      });
    },
  };
});
