import { gematriya } from '@hebcal/core';
import { SectionHeading } from '@/components/SectionHeading';
import { localized } from '@/lib/localized';
import { hslToRgb, rgbToHex, rgbToHsl, toSpine, type RGB } from '@/lib/color';
import type { BookWithRelations, Series } from '@/lib/supabase/types';
import { SeriesShelfClient, type SeriesShelfVolume } from './SeriesShelfClient';

/**
 * [1.39] מדף הסדרה: כל הכרכים עומדים על מדף, כרך ליד כרך, בשפה החזותית
 * של מדף עמוד הבית — הכרך שלפניכם גבוה יותר, מסומן בזהב וממורכז מראש.
 *
 * מחליף את ציר העיגולים הממוספרים (SeriesTimeline), שנשבר לכמה שורות
 * ברגע שהסדרה עברה ארבעה-חמישה כרכים — בעמודה של חצי רוחב, לצד המחבר,
 * כמעט תמיד. שדרה תופסת פחות מ-3rem, ולכן גם סדרה של עשרות כרכים
 * נשארת מדף אחד: מגלגלים, לא שוברים שורה (ראו SeriesShelfClient).
 *
 * הרכיב הזה רץ בשרת ומכין נתונים סדרתיים בלבד לרכיב הלקוח: כותרות
 * מתורגמות, מספור (באותיות עבריות בעברית — כרך י״ד, לא כרך 14 — מספרות
 * תורנית מקבלת את המספור שלה), וצבעי השדרה.
 *
 * צבעי השדרה בלי sharp: הכריכה עצמה לא נקראת כאן. מדף עמוד הבית גוזר
 * צבע מהכריכה (getSpineLook) לעשרה ספרים לכל היותר; סדרה יכולה להיות
 * עשרות כרכים, ורינדור עמוד הספר לא ימתין לעשרות הורדות כריכה. במקום
 * זה: accent_primary של הכרך אם הוגדר (אותו צבע שמשמש את ה-Hero שלו),
 * ואחרת פלטת הזהות החזותית לפי מיקום — כך המדף מלא וצבעוני מהיום הראשון,
 * ושדרה שצולמה (spine_image_url) תמיד גוברת.
 */

/** בורגונדי, נייבי, נייבי-בהיר, זהב עמוק, חום-דיו — צבעי הזהות, בסבב לפי מיקום. */
const IDENTITY_SPINES: RGB[] = [
  [107, 31, 38],
  [20, 36, 58],
  [36, 64, 95],
  [138, 104, 32],
  [66, 59, 48],
];

function parseHex(hex: string): RGB | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** גוף השדרה וקצה כהה יותר — אותו יחס כמו בשדרה הנגזרת ממדף עמוד הבית. */
function spineColours(book: BookWithRelations, index: number): { base: string; edge: string } {
  const accent = book.accent_primary ? parseHex(book.accent_primary) : null;
  const base = accent ? toSpine(accent) : IDENTITY_SPINES[index % IDENTITY_SPINES.length];
  const [h, s, l] = rgbToHsl(base);
  return { base: rgbToHex(base), edge: rgbToHex(hslToRgb([h, s, l * 0.62])) };
}

export function SeriesShelf({
  series,
  currentBook,
  volumes,
  locale,
  t,
}: {
  series: Pick<Series, 'id' | 'slug' | 'name_he' | 'name_en'>;
  currentBook: BookWithRelations;
  volumes: BookWithRelations[];
  locale: string;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  const seriesName = localized(series, 'name', locale);
  const all = [...volumes, currentBook].sort(
    (a, b) => (a.series_position ?? 999) - (b.series_position ?? 999),
  );
  const numeral = (n: number) => (locale === 'he' ? gematriya(n) : String(n));

  const shelf: SeriesShelfVolume[] = all.map((volume, index) => {
    const { base, edge } = spineColours(volume, index);
    const position = volume.series_position;
    return {
      id: volume.id,
      slug: volume.slug,
      title: localized(volume, 'title', locale),
      positionLabel: position ? numeral(position) : null,
      volumeLabel: position ? t('seriesVolume', { n: numeral(position) }) : null,
      jumpLabel: position ? t('seriesJumpTo', { n: numeral(position) }) : localized(volume, 'title', locale),
      spineUrl: volume.spine_image_url,
      spineBase: base,
      spineEdge: edge,
      isCurrent: volume.id === currentBook.id,
    };
  });

  const current = shelf.find((volume) => volume.isCurrent) ?? shelf[0];
  const positionText = current.positionLabel
    ? t('seriesPosition', { n: current.positionLabel, total: numeral(all.length) })
    : current.title;

  return (
    <section aria-labelledby="book-series">
      <SectionHeading level={2} eyebrow={t('seriesIntro')} title={seriesName} id="book-series" />
      <SeriesShelfClient
        volumes={shelf}
        labels={{
          shelf: t('seriesShelfLabel'),
          current: t('seriesCurrentVolume'),
          prev: t('seriesPrev'),
          next: t('seriesNext'),
          position: positionText,
          currentTitle: current.title,
        }}
      />
    </section>
  );
}
