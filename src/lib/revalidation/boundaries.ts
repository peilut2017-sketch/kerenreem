import 'server-only';

import { bannerWindow } from '@/lib/banner-window';

/**
 * ‏[1.42] סורק הגבולות — המנגנון שהחליף את ה-ISR מבוסס-הזמן.
 *
 * ## מה הבעיה שהוא פותר
 *
 * שלושה דברים באתר משתנים **בלי ששום שורה במסד משתנה**, ולכן בלי שום
 * ‏mutation שיפעיל revalidatePath:
 *
 *   1. ‏sale_starts_at / sale_ends_at — מבצע נפתח ונסגר לפי שעון.
 *      ‏getEffectivePrice מכריע זאת בזמן הרינדור (commerce/pricing.ts).
 *   2. ‏banners.starts_at / ends_at — אותו דבר לעמוד הבית.
 *   3. אירוע שעובר מ"קרוב" ל"היה" בחצות (isUpcoming).
 *
 * עד כה הפתרון היה ‎revalidate = 60 על כל עמוד שמושפע: העמוד נכתב מחדש
 * בכל דקה, לנצח, כדי לתפוס מעבר שקורה פעם בשבוע. מכאן ~1,900 כתיבות
 * ISR בשעה שבהן שום דבר לא השתנה.
 *
 * כאן ההיגיון הפוך: פעם ב-15 דקות **שואלים** אם נחצה גבול. אם לא —
 * יוצאים בלי לגעת בשום מטמון. **אפס כתיבות כשאין שינוי** היא הדרישה
 * המרכזית, והתנאי `paths.length === 0` למטה הוא מה שמקיים אותה.
 *
 * ## הסמן
 *
 * ‏site_settings.extra.revalidation_cursor_at, ולא טבלה חדשה: העמודה
 * הזו היא כבר המקום שבו הפרויקט מחזיק state תפעולי קטן (banners_enabled,
 * shelf_book_ids, inquiry_inbox_*), יש לה helper מוכן, ואין צורך במיגרציה.
 *
 * החלון חצי-פתוח ‎[T0, T1) — גבול נכנס לחלון אחד בדיוק, אף פעם לשניים.
 *
 * הסמן מתקדם **רק אחרי** רענון מוצלח. המשמעות: ריצה שנכשלת באמצע תחזור
 * על אותו חלון בריצה הבאה, כלומר רענון כפול אפשרי. זו העדפה מכוונת —
 * רענון כפול הוא כתיבה מיותרת, גבול שאבד הוא מבצע שלא התחיל.
 *
 * ## למה אין lock
 *
 * ‏Vercel Cron אינו מריץ שני מופעים של אותו לוח זמנים במקביל, וגם אם כן
 * — שתי ריצות על אותו חלון מפיקות בדיוק את אותה רשימת נתיבים, ו-
 * ‏revalidatePath אידמפוטנטי. המחיר במקרה הנדיר הוא כתיבה כפולה, שזה
 * בדיוק מה שהוחלט להעדיף. lock היה מוסיף state שצריך גם לפוג בעצמו.
 */

const DAY_MS = 24 * 60 * 60_000;

/** מפתח הסמן בתוך site_settings.extra. */
export const CURSOR_KEY = 'revalidation_cursor_at';

/**
 * החלון שמניחים כשאין סמן כלל (התקנה חדשה, או אחרי איפוס). מכוון להיות
 * ארוך מתדירות הקרון, כדי שגבול שנחצה רגע לפני הריצה הראשונה לא יאבד.
 */
export const DEFAULT_LOOKBACK_MS = 20 * 60_000;

/**
 * מעל כמה נתיבים עוברים לביטול גורף.
 *
 * ‏200 נתיבים הם ~95 ספרים שחוצים גבול באותו חלון של 15 דקות — מצב
 * שאינו קורה בשימוש רגיל אלא אחרי השבתה ארוכה או שינוי מבצעים סיטוני.
 * מעבר לזה, ביטול ממוקד הוא כבר יותר כתיבות מביטול העץ כולו, וגם
 * מסתכן בבקשה שנחתכת באמצע ומשאירה חלק מהנתיבים לא מרועננים.
 *
 * זה **לא** משמש כתחליף נוח לסריקה: הסריקה והקיבוץ קורים בכל מקרה,
 * והדגל הזה נבדק רק על התוצאה הסופית.
 */
export const OVERFLOW_THRESHOLD = 200;

export interface BoundaryBook {
  slug: string;
  /** ה-slug של המחבר המשויך, או null (מחבר כטקסט חופשי / בלי מחבר). */
  authorSlug: string | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
}

export interface BoundaryBanner {
  starts_at: string | null;
  ends_at: string | null;
}

export interface BoundaryEvent {
  /** עמודת date. */
  eventDate: string | null;
}

export interface BoundaryScan {
  /** נתיבים קונקרטיים, ללא כפילויות. */
  paths: string[];
  counts: { books: number; banners: number; events: number };
  /** true כשמספר הנתיבים חרג מהסף — ראו OVERFLOW_THRESHOLD. */
  overflow: boolean;
}

/** האם רגע הזמן הזה נחצה בחלון [from, to). */
function crossed(at: number | null, from: number, to: number): boolean {
  return at != null && at >= from && at < to;
}

/**
 * הרגע שבו אירוע עובר מ"קרוב" ל"היה".
 *
 * ‏isUpcoming (lib/hebrew-date.ts) בודק `date >= startOfDay(now)`, כלומר
 * אירוע ביום D נחשב קרוב כל עוד ‎now < startOfDay(D) + יום. זה הרגע.
 */
function eventFlipAt(eventDate: string): number | null {
  const parsed = new Date(`${eventDate}T00:00:00`);
  const time = parsed.getTime();
  return Number.isNaN(time) ? null : time + DAY_MS;
}

/**
 * בניית רשימת הנתיבים לרענון. **פונקציה טהורה** — בלי מסד ובלי Next,
 * כדי שכל ההיגיון (גבולות, שתי שפות, עמודי מחבר, קיבוץ) ייבדק ישירות.
 */
export function buildBoundaryPaths(input: {
  from: number;
  to: number;
  books: BoundaryBook[];
  banners: BoundaryBanner[];
  events: BoundaryEvent[];
}): BoundaryScan {
  const { from, to } = input;

  /*
   * ‏Set ולא מערך: עשרים ספרים שחוצים גבול יחד דורשים את /books ואת /
   * עשרים פעם כל אחד. כל נתיב מתבטל **פעם אחת** בכל ריצה.
   */
  const paths = new Set<string>();
  const counts = { books: 0, banners: 0, events: 0 };

  /** אותו נתיב בשתי השפות. עברית בלי קידומת (localePrefix: 'as-needed'). */
  const both = (path: string) => {
    paths.add(path === '/' ? '/' : path);
    paths.add(path === '/' ? '/en' : `/en${path}`);
  };

  for (const book of input.books) {
    const starts = book.saleStartsAt ? new Date(book.saleStartsAt).getTime() : null;
    const ends = book.saleEndsAt ? new Date(book.saleEndsAt).getTime() : null;
    if (!crossed(starts, from, to) && !crossed(ends, from, to)) continue;

    counts.books += 1;
    // עמוד הספר, הקטלוג (מציג מחיר בכרטיס) ועמוד הבית (מדף/נצפים).
    both(`/books/${book.slug}`);
    both('/books');
    both('/');
    // עמוד המחבר מציג BookCard עם מחיר, ולכן מושפע גם הוא. רק כשיש
    // שיוך אמיתי: ספר עם מחבר כטקסט חופשי אינו מופיע בשום עמוד מחבר.
    if (book.authorSlug) both(`/authors/${book.authorSlug}`);
  }

  for (const banner of input.banners) {
    const { startsAt, endsAt } = bannerWindow(banner);
    if (!crossed(startsAt, from, to) && !crossed(endsAt, from, to)) continue;
    counts.banners += 1;
    // באנרים מופיעים בעמוד הבית בלבד.
    both('/');
  }

  for (const event of input.events) {
    if (!event.eventDate) continue;
    if (!crossed(eventFlipAt(event.eventDate), from, to)) continue;
    counts.events += 1;
    // הפיצול קרובים/היו הוא ברשימה בלבד; עמוד האירוע הבודד אינו תלוי בתאריך.
    both('/events');
  }

  return {
    paths: [...paths],
    counts,
    overflow: paths.size > OVERFLOW_THRESHOLD,
  };
}
