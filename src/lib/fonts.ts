import type { CSSProperties } from 'react';
import {
  Frank_Ruhl_Libre,
  Assistant,
  Heebo,
  Rubik,
  Noto_Sans_Hebrew,
  David_Libre,
  Secular_One,
  Alef,
  Suez_One,
  Bellefair,
} from 'next/font/google';

/**
 * כל הגופנים החינמיים של האתר, במקום אחד.
 *
 * שני הראשונים (Frank Ruhl Libre, Assistant) הם גופני ברירת המחדל של
 * מערכת העיצוב — כותרות וגוף טקסט, בהתאמה — וטוענים כאן ולא בנפרד בכל
 * root layout, כדי שלא יורדו פעמיים (האתר הציבורי וממשק הניהול, שכל אחד
 * מהם <html> נפרד, קודם טענו אותם עצמאית).
 *
 * שאר הגופנים הם המגוון החינמי שנוסף לבחירה בעורך התוכן: כולם מ-Google
 * Fonts עם תמיכה מלאה בעברית. next/font/google מוריד ומארח את הקבצים
 * בעצמו בזמן הבנייה — אין קריאת רשת בזמן ריצה ל-fonts.googleapis.com,
 * ולכן אין צורך להרחיב את ה-CSP (font-src 'self' בלבד, ראו next.config.ts).
 *
 * כל גופן חשוף כמשתנה CSS (variable). זה קריטי לעורך: RichTextEditor
 * שומר בחירת גופן כ-style="font-family:var(--font-heebo)" בתוך ה-HTML
 * שנשמר במסד (ראו EDITOR_FONT_CHOICES למטה) — לא כשם הגופן הפנימי
 * שנוצר על ידי next/font. משתנה ה-CSS מתפענח נכון בכל מקום שבו ה-HTML
 * הזה מוצג בסוף, כי גם עורך התוכן וגם עמוד הספר הציבורי הם צאצאים של
 * <html> שעליו FONT_VARIABLES מוחל — ראו את שני ה-root layout.
 */

const frank = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-frank',
  display: 'swap',
});

const assistant = Assistant({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '600', '700'],
  variable: '--font-assistant',
  display: 'swap',
});

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-heebo',
  display: 'swap',
});

const rubik = Rubik({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-rubik',
  display: 'swap',
});

const notoSansHebrew = Noto_Sans_Hebrew({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-hebrew',
  display: 'swap',
});

const davidLibre = David_Libre({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-david-libre',
  display: 'swap',
});

const secularOne = Secular_One({
  subsets: ['hebrew', 'latin'],
  weight: '400',
  variable: '--font-secular-one',
  display: 'swap',
});

const alef = Alef({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '700'],
  variable: '--font-alef',
  display: 'swap',
});

/**
 * [1.11] גופן התצוגה של כותרות עמוד הבית — Suez One: סריף עברי כבד
 * ומרשים שנבנה במיוחד לכותרות (משקל יחיד). לא מחליף את Frank Ruhl
 * בכלל הכותרות — רק בכותרות המקטעים הגדולות, דרך --font-display.
 */
const suezOne = Suez_One({
  subsets: ['hebrew', 'latin'],
  weight: '400',
  variable: '--font-suez',
  display: 'swap',
});

/** סריף חגיגי דק עם עברית — עוד אפשרות בעורך התוכן. */
const bellefair = Bellefair({
  subsets: ['hebrew', 'latin'],
  weight: '400',
  variable: '--font-bellefair',
  display: 'swap',
});

/** מוחל על ה-<html> בשני ה-root layout — חושף את כל משתני הגופנים לכל עץ ה-DOM שמתחתיו. */
export const FONT_VARIABLES = [
  frank.variable,
  assistant.variable,
  heebo.variable,
  rubik.variable,
  notoSansHebrew.variable,
  davidLibre.variable,
  secularOne.variable,
  alef.variable,
  suezOne.variable,
  bellefair.variable,
].join(' ');

/**
 * הרשימה שנחשפת לבורר הגופנים בעורך התוכן.
 * value הוא ה-CSS var שנשמר בפועל בתוך ה-HTML, לא שם הגופן הפנימי.
 */
export const EDITOR_FONT_CHOICES: { label: string; value: string }[] = [
  { label: 'Assistant (ברירת מחדל)', value: 'var(--font-assistant)' },
  { label: 'Frank Ruhl Libre', value: 'var(--font-frank)' },
  { label: 'Heebo', value: 'var(--font-heebo)' },
  { label: 'Rubik', value: 'var(--font-rubik)' },
  { label: 'Noto Sans Hebrew', value: 'var(--font-noto-hebrew)' },
  { label: 'David Libre', value: 'var(--font-david-libre)' },
  { label: 'Secular One', value: 'var(--font-secular-one)' },
  { label: 'Alef', value: 'var(--font-alef)' },
  { label: 'Suez One (כותרות)', value: 'var(--font-suez)' },
  { label: 'Bellefair', value: 'var(--font-bellefair)' },
];

/* --------------------------------------------------------------------------
   גופני ברירת המחדל של האתר — ניתנים להחלפה מניהול ← הגדרות
   --------------------------------------------------------------------------
   מערכת העיצוב מגדירה שלושה תפקידי גופן (globals.css, @theme): גוף הטקסט
   (--font-sans), כותרות (--font-serif) וכותרות התצוגה הגדולות
   (--font-display). הבחירה נשמרת ב-site_settings.extra כמשתנה CSS מלא
   (var(--font-heebo) או var(--font-custom-<slug>) לגופן מותקן), ומוחלת
   כ-style ישיר על ה-<html> הציבורי — הצהרת inline גוברת על ערכי ה-@theme
   בלי תלות בסדר טעינת ה-CSS. ריק/חסר = ברירות המחדל של מערכת העיצוב.
   -------------------------------------------------------------------------- */

export type SiteFontRole = 'sans' | 'serif' | 'display';

export const SITE_FONT_ROLES: { role: SiteFontRole; label: string; hint: string }[] = [
  { role: 'sans', label: 'גוף הטקסט', hint: 'ברירת מחדל: Assistant — רוב הטקסט באתר.' },
  { role: 'serif', label: 'כותרות', hint: 'ברירת מחדל: Frank Ruhl Libre — כותרות עמודים ומקטעים.' },
  {
    role: 'display',
    label: 'כותרות ראשיות',
    hint: 'ברירת מחדל: Suez One — כותרות המקטעים הגדולות בעמוד הבית.',
  },
];

/**
 * ערך חוקי הוא משתנה גופן סגור בלבד — אותה משפחת ערכים ש-sanitize.ts כבר
 * מתיר בתוכן עשיר. שום דבר אחר (מרכאות, סוגריים, נקודה-פסיק) לא עובר,
 * ולכן אין דרך להזריק CSS דרך ההגדרה.
 */
export const SITE_FONT_VALUE_PATTERN = /^var\(--font-[a-z0-9-]{1,60}\)$/;

/** מחסני נפילה לכל תפקיד — נשמרים גם כשגופן ברירת המחדל הוחלף. */
const SITE_FONT_FALLBACKS: Record<SiteFontRole, string> = {
  sans: "'Assistant', system-ui, -apple-system, sans-serif",
  serif: "'Frank Ruhl Libre', 'David Libre', Georgia, serif",
  display: "'Suez One', Georgia, serif",
};

/**
 * דריסות הגופנים מתוך site_settings.extra (מפתחות font_sans/font_serif/
 * font_display) — כאובייקט style לרכיב ה-<html>. ערך לא-חוקי מדולג בשקט.
 */
export function siteFontOverrides(extra: Record<string, unknown>): CSSProperties {
  const style: Record<string, string> = {};
  for (const { role } of SITE_FONT_ROLES) {
    const value = extra[`font_${role}`];
    if (typeof value === 'string' && SITE_FONT_VALUE_PATTERN.test(value)) {
      // המחסנים נכנסים כ-fallback של ה-var() עצמו — כך גם גופן מותקן
      // שנמחק או כובה (המשתנה שלו כבר לא מוזרק) נופל לברירת המחדל,
      // במקום להשאיר font-family לא-חוקי.
      style[`--font-${role}`] = `${value.slice(0, -1)}, ${SITE_FONT_FALLBACKS[role]})`;
    }
  }
  return style as CSSProperties;
}
