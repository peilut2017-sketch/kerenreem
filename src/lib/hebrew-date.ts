import { HDate, Locale, gematriya } from '@hebcal/core';

/**
 * המרת תאריכים לועזי↔עברי.
 *
 * עיקרון האחסון: במסד נשמר תמיד תאריך לועזי (date / timestamptz) כמקור אמת
 * יחיד — כך המיון והסינון עובדים על שדה תקני אחד. ההמרה לעברית נעשית כאן,
 * בזמן התצוגה בלבד.
 *
 * חריג מכוון: שנת הוצאת ספר נשמרת בשני שדות (publication_year_he טקסט,
 * publication_year_ce מספר), כי לעיתים ידועה רק השנה העברית והצורה העברית
 * היא המקור התיעודי. שדות אלה אינם עוברים דרך המודול הזה.
 */

export type DateDisplayMode = 'both' | 'hebrew' | 'gregorian';

/**
 * המרת "2026-07-29" לתאריך מקומי בחצות, בלי הסטה של אזור זמן.
 * חשוב: `new Date('2026-07-29')` נקרא כ-UTC ועלול להחזיר את היום הקודם
 * במקומות שממערב לגריניץ'.
 */
export function parseDateOnly(value: string | Date): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (!value) return null;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export interface HebrewDateOptions {
  /**
   * האם התאריך מתייחס לאירוע שאחרי שקיעה. היום העברי מתחלף בשקיעה, ולכן
   * אירוע ערב (למשל כנס שמתחיל ב-20:30) שייך כבר לתאריך העברי של המחרת.
   * ברירת מחדל: false — אירוע יום.
   */
  afterSunset?: boolean;
}

/** "ט״ו באב תשפ״ו" */
export function toHebrewDate(date: Date, options: HebrewDateOptions = {}): string {
  const hd = new HDate(date);
  const effective = options.afterSunset ? hd.next() : hd;

  const day = gematriya(effective.getDate());
  const monthKey = HDate.getMonthName(effective.getMonth(), effective.getFullYear());
  const monthName = Locale.gettext(monthKey, 'he-x-NoNikud') || monthKey;
  const year = gematriya(effective.getFullYear());

  // תחילית ב׳ היא הצורה המקובלת: "ט״ו באב", "א׳ בתשרי".
  return `${day} ב${monthName} ${year}`;
}

/** רק החודש והיום — לאירועים שנתיים חוזרים: "ט״ו באב" */
export function toHebrewDayMonth(date: Date, options: HebrewDateOptions = {}): string {
  const hd = new HDate(date);
  const effective = options.afterSunset ? hd.next() : hd;
  const monthKey = HDate.getMonthName(effective.getMonth(), effective.getFullYear());
  const monthName = Locale.gettext(monthKey, 'he-x-NoNikud') || monthKey;
  return `${gematriya(effective.getDate())} ב${monthName}`;
}

/** רק השנה העברית: "תשפ״ו" */
export function toHebrewYear(date: Date): string {
  return gematriya(new HDate(date).getFullYear());
}

/**
 * הצורה העברית לפי שפת הממשק: בעברית באותיות ("ט״ו באב תשפ״ו"),
 * באנגלית בתעתיק ("15 Av 5786") — גרשיים עבריים בתוך משפט אנגלי אינם קריאים.
 */
export function toHebrewDateLocalized(
  date: Date,
  locale: string,
  options: HebrewDateOptions = {},
): string {
  if (locale === 'he') return toHebrewDate(date, options);
  const hd = new HDate(date);
  return (options.afterSunset ? hd.next() : hd).render('en');
}

/** "29 ביולי 2026" / "29 July 2026" */
export function toGregorianDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jerusalem',
  }).format(date);
}

/** "2026-07-29" — לתגית <time dateTime> ולנתוני מבנה (JSON-LD). */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * הצורה המלאה כפי שהיא מוצגת באתר.
 * בעברית העברי מקדים: "ט״ו באב תשפ״ו (29 ביולי 2026)".
 * באנגלית הלועזי מקדים: "29 July 2026 (15 Av 5786)".
 */
export function formatDate(
  date: Date,
  locale: string,
  mode: DateDisplayMode = 'both',
  options: HebrewDateOptions = {},
): string {
  const hebrew = toHebrewDateLocalized(date, locale, options);
  const gregorian = toGregorianDate(date, locale);

  if (mode === 'hebrew') return hebrew;
  if (mode === 'gregorian') return gregorian;

  return locale === 'he' ? `${hebrew} (${gregorian})` : `${gregorian} (${hebrew})`;
}

/** האם התאריך עדיין לפנינו (לצורך חלוקה ל"קרובים" ו"שהיו"). */
export function isUpcoming(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() >= today.getTime();
}
