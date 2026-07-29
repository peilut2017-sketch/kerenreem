import { defineRouting } from 'next-intl/routing';

export const locales = ['he', 'en'] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: 'he',
  // עברית ללא קידומת (/books), אנגלית עם קידומת (/en/books).
  localePrefix: 'as-needed',
  // אין זיהוי אוטומטי לפי Accept-Language: הארגון ישראלי, עברית היא ברירת המחדל.
  localeDetection: false,
});

export const localeDirection: Record<Locale, 'rtl' | 'ltr'> = {
  he: 'rtl',
  en: 'ltr',
};

export function isRtl(locale: string): boolean {
  return localeDirection[locale as Locale] === 'rtl';
}
