/**
 * כתובת מלאה באתר לפי שפת ההזמנה. localePrefix הוא 'as-needed' (עברית
 * בלי קידומת, אנגלית עם /en) — וכל הכתובות שנשלחו ללקוח (חזרה מדף
 * התשלום, מעקב, חשבון) נבנו בלי הקידומת, כך שלקוח שהזמין באנגלית נחת
 * תמיד בעברית. order.locale זמין בכל נקודות הבנייה האלה.
 */
export function localizedSiteUrl(locale: string | null | undefined, path: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const prefix = locale === 'en' ? '/en' : '';
  return `${base}${prefix}${path}`;
}
