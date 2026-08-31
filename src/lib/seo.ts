import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';

/**
 * ‏canonical ו-hreflang לעמוד ציבורי — מקור יחיד.
 *
 * למה זה קיים: ה-layout הגדיר בעבר alternates.languages גלובלי שמצביע
 * תמיד על עמוד הבית ('/', '/en'). מטא-דאטה ב-Next עוברת בירושה, כך שכל
 * עמוד שלא דרס אותה (כלומר: כולם חוץ מעמוד הספר) שידר לגוגל
 * hreflang שגוי — "הגרסה האנגלית של /events היא /en" — מה שמפרק את
 * אשכול השפות של כל עמוד. עכשיו כל עמוד קורא לפונקציה הזו עם הנתיב
 * שלו, וה-layout לא מגדיר alternates בכלל.
 *
 * path — הנתיב בלי קידומת שפה ('/books', '/events/slug', '' לעמוד הבית).
 */
export function pageAlternates(locale: string, path: string): NonNullable<Metadata['alternates']> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const urlFor = (loc: string) =>
    `${siteUrl}${loc === routing.defaultLocale ? '' : `/${loc}`}${path}`;

  return {
    canonical: urlFor(locale),
    languages: {
      ...Object.fromEntries(routing.locales.map((loc) => [loc, urlFor(loc)])),
      'x-default': urlFor(routing.defaultLocale),
    },
  };
}
