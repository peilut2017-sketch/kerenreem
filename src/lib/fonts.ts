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
