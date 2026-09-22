import { Link } from '@/i18n/navigation';
import { toCdnUrl } from '@/lib/image-src';

/**
 * סמל הקרן ושמה.
 *
 * כשהועלה לוגו ב-CMS הוא מוצג. עד אז מוצג סימן שנגזר מהלוגו — קשת של
 * שער בית מדרש עם ספר פתוח וקרני אור, בזהב. הוא בנוי כ-SVG inline כדי
 * שיירש את הצבע מהרקע: זהב על כהה, ודיו על נייר.
 *
 * הסמל גדול משורת הכותרת ובולט אל מחוץ לה — גם מהפס היציב בראש
 * העמוד וגם מקפסולת הזכוכית הצפה שבגלילה — **בלי להגדיל את הכותרת
 * ולו בפיקסל אחד**. המידות, האילוץ שהן מקיימות והנימוקים מרוכזים
 * בקבועים שמתחת.
 */

/**
 * ‏[1.41] מידות הסמל, ולמה שלושה מספרים לכל מצב ולא אחד.
 *
 * הדרישה: הסמל ייראה כחלק מהכותרת, עם בליטה קטנה ומכוונת מתחתיה אל
 * ה-hero — לא כאילו הוזז למטה. בפועל: כ-75% ממנו בתוך הכותרת, וכ-25%
 * בולטים.
 *
 * הגרסה הקודמת השתמשה בשוליים תחתונים שליליים בלבד. התוצאה: קופסת
 * השוליים התחילה בדיוק בראש שורת ה-flex, ולכן הסמל התחיל נמוך —
 * במרחק כל הריפוד העליון של הכותרת (20px) — והמשיך הרבה מתחתיה. ביחס
 * לשם האתר שלצידו, שממורכז בשורה, הוא נראה *שמוט למטה*; וזה בדיוק מה
 * שדווח במובייל.
 *
 * התיקון: לפצל את הקיצור בין למעלה ולמטה. שוליים עליונים שליליים
 * מושכים את הסמל אל ראש הכותרת (נשאר רווח קטן ומכוון), והתחתונים
 * מייצרים את הזנב. האילוץ נשמר כפי שהיה:
 *
 *     גובה נראה − (שוליים עליונים + שוליים תחתונים) = הגובה השמור
 *
 * והגובה השמור זהה לחלוטין לקודם, ולכן **הכותרת אינה גדלה בפיקסל**:
 * ‏2.75rem (בסיס) · 3rem (sm ומעלה) למצב המלא, 2rem · 2.25rem למכווץ.
 *
 * החישוב, מול ריפוד הכותרת (py-5 = 20px ביציב, py-2.5 = 10px בקפסולה
 * הצפה). "רווח עליון" = ריפוד מינוס השוליים העליונים; "בולט" = השוליים
 * התחתונים מינוס הריפוד:
 *
 *   מצב        גובה  עליון  תחתון  שמור  רווח  בולט  בפנים
 *   full  בסיס  96    8      44     44    12    24    75%
 *   full  sm+   104   12     44     48    8     24    77%
 *   compact בסיס 68   4      32     32    6     22    76%
 *   compact sm   72   4      32     36    6     22    76%
 *
 * במצב הצף שורת הקפסולה גבוהה מהסמל (כפתורי הפעולה בגובה 44px), ולכן
 * ‏items-center מוריד אותו עוד כ-6px — הרווח העליון והבליטה נמדדו שם
 * ‏12px ו-16px בפועל. המדידה מאשרת 75%–79% בפנים בכל ארבעת המצבים.
 *
 * ‏**למה לא position: absolute**, שהוא הפתרון המתבקש לעיגון: סמל
 * שמוצא מזרימת המסמך אינו תורם רוחב, ושם האתר שלצידו היה נדחף מתחתיו.
 * אי אפשר לשריין לו רוחב, כי הלוגו מגיע מה-CMS ויחס הצדדים שלו אינו
 * ידוע מראש. שוליים שליליים נותנים את אותו עיגון *ביחס לכותרת* תוך
 * שמירה על הרוחב בזרימה.
 *
 * למה לא transform: scale — הוא מותח תמונה שנצרבה בגודל הקטן, והתוצאה
 * מטושטשת. שוליים שליליים משאירים אותה ברזולוציה המלאה.
 *
 * הגלישה אפשרית משום שאין overflow:hidden על משטח הכותרת, ו-z-10 על
 * הקישור מוודא שהחלק הבולט נמצא מעל התוכן שמתחת ולא נחתך על ידו.
 */

/** הגובה הנראה של הסמל בכותרת (עם בליטה). */
const LOGO_HEIGHT = {
  full: 'h-24 sm:h-[6.5rem]',
  compact: 'h-[4.25rem] sm:h-[4.5rem]',
} as const;

/**
 * הגובה כשאין בליטה — הכותרת התחתונה. שם הסמל יושב מעל פסקת טקסט,
 * אין לו מסגרת לבלוט ממנה, ומידות הכותרת העליונה היו גדולות שם שלא
 * לצורך. נשאר כפי שהיה.
 */
const LOGO_HEIGHT_STATIC = {
  full: 'h-[5.25rem] sm:h-[5.5rem] lg:h-[6rem]',
  compact: 'h-[3.75rem] sm:h-[4.25rem]',
} as const;

/**
 * העיגון לראש הכותרת: שוליים עליונים שליליים קטנים. הם מקטינים את
 * הרווח שמעל הסמל מ-20px ל-12px (8px ב-sm), כך שהוא קורא כחלק
 * מהכותרת ולא כאלמנט ששוקע מתחתיה.
 */
const LOGO_LIFT = {
  full: '-mt-2 sm:-mt-3',
  compact: '-mt-1',
} as const;

/**
 * הבליטה: שוליים תחתונים שליליים. גדולים מהריפוד התחתון של הכותרת,
 * ולכן הסמל באמת יוצא אל מחוץ למסגרת — 24px ביציב, 16px בקפסולה הצפה.
 */
const LOGO_OVERHANG = {
  full: '-mb-11',
  compact: '-mb-8',
} as const;

export function Wordmark({
  logoUrl,
  darkLogoUrl,
  name,
  tagline,
  variant = 'light',
  compact = false,
  overhang = true,
}: {
  logoUrl: string | null;
  /** גרסה הפוכה/בהירה ללוגו, לשימוש כש-variant='dark'. null — נופל ל-logoUrl עם משטח עוגן. */
  darkLogoUrl?: string | null;
  name: string;
  tagline?: string;
  /** 'light' — על נייר, 'dark' — על הכחול העמוק */
  variant?: 'light' | 'dark';
  /** גרסה מכווצת — לוגו וטקסט קטנים יותר, לניווט במצב צף */
  compact?: boolean;
  /**
   * האם הסמל גולש מתחת לשורה שבה הוא יושב. נכון בכותרת האתר (זה בדיוק
   * האפקט המבוקש); שקר בכותרת התחתונה, שם מתחתיו יושב טקסט.
   */
  overhang?: boolean;
}) {
  const rawLogo = variant === 'dark' ? (darkLogoUrl || logoUrl) : logoUrl;
  const resolvedLogo = rawLogo ? toCdnUrl(rawLogo) : rawLogo;

  /**
   * לוגו שהועלה בלי גרסה ייעודית לרקע כהה עשוי להיות כהה בעצמו — למשל
   * כיתוב שחור על נייר שקוף — ואז הוא נבלע ברקע הכחול-עמוק. במקום להניח
   * שהקובץ יתאים, הוא יושב על משטח בהיר קטן וקבוע שמבטיח ניגודיות בכל
   * מקרה. ברגע שתועלה גרסה ייעודית (logo_dark_url) העטיפה הזו מתבטלת —
   * הקובץ שהועלה במיוחד לרקע כהה מוצג כמו שהוא, בלי משטח מתחתיו.
   */
  const needsBackerPlate = variant === 'dark' && !darkLogoUrl && Boolean(logoUrl);

  const key = compact ? 'compact' : 'full';
  /*
   * חסם רוחב: הסמל מגיע מה-CMS ויחס הצדדים שלו אינו ידוע מראש. לוגו
   * רחב (כיתוב לרוחב, יחס 4:1) בגובה שנקבע כאן היה גולש אופקית במסך
   * טלפון — וגלישה אופקית היא כשל נגישות, לא רק חוסר נוחות. עם
   * object-contain שכבר מוגדר עליו, החסם מקטין אותו פרופורציונלית
   * במקום לחתוך אותו; לוגו כזה יבלוט פחות, וזה הפשרה הנכונה.
   */
  const logoSize = overhang
    ? `max-w-[46vw] sm:max-w-[20rem] ${LOGO_HEIGHT[key]} ${LOGO_LIFT[key]} ${LOGO_OVERHANG[key]}`
    : `max-w-[46vw] sm:max-w-[20rem] ${LOGO_HEIGHT_STATIC[key]}`;

  return (
    <Link
      href="/"
      className="group relative z-10 flex items-center gap-3 transition-[gap] duration-[420ms] ease-[var(--ease-spring)] focus-visible:outline-offset-4 motion-reduce:transition-none"
    >
      {resolvedLogo ? (
        needsBackerPlate ? (
          <span
            className={`inline-flex w-auto shrink-0 items-center rounded-[var(--radius-sm)] bg-cream px-2 py-1 shadow-[var(--shadow-soft)] transition-[height,margin] duration-[420ms] ease-[var(--ease-spring)] motion-reduce:transition-none ${logoSize}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- הלוגו מוגדר ב-CMS ומוגש כפי שהוא */}
            <img src={resolvedLogo} alt={name} className="h-full w-auto object-contain" />
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- הלוגו מוגדר ב-CMS ומוגש כפי שהוא
          <img
            src={resolvedLogo}
            alt={name}
            className={`w-auto shrink-0 object-contain ${overhang ? 'object-top' : ''} transition-[height,margin] duration-[420ms] ease-[var(--ease-spring)] motion-reduce:transition-none ${logoSize}`}
          />
        )
      ) : (
        <MarkSvg
          compact={compact}
          overhang={overhang}
          className={variant === 'dark' ? 'text-gold' : 'text-gold-deep'}
        />
      )}

      <span className="leading-tight">
        <span
          className={`block font-serif transition-[font-size] duration-[420ms] ease-[var(--ease-spring)] motion-reduce:transition-none ${
            compact ? 'text-[1rem] sm:text-[1.0625rem]' : 'text-[1.1875rem] sm:text-[1.3125rem]'
          } ${variant === 'dark' ? 'text-white' : 'text-ink group-hover:text-burgundy'} transition-colors`}
        >
          {name}
        </span>
        {tagline ? (
          <span
            className={`mt-0.5 hidden text-caption leading-snug sm:block ${
              compact ? 'sm:hidden' : ''
            } ${variant === 'dark' ? 'text-cream-2/70' : 'text-muted'}`}
          >
            {tagline}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function MarkSvg({
  className = '',
  compact = false,
  overhang = true,
}: {
  className?: string;
  compact?: boolean;
  overhang?: boolean;
}) {
  const key = compact ? 'compact' : 'full';
  return (
    <svg
      viewBox="0 0 48 56"
      className={`w-auto shrink-0 transition-[height,margin] duration-[420ms] ease-[var(--ease-spring)] motion-reduce:transition-none ${
        overhang
          ? `${LOGO_HEIGHT[key]} ${LOGO_LIFT[key]} ${LOGO_OVERHANG[key]}`
          : LOGO_HEIGHT_STATIC[key]
      } ${className}`}
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      {/* קשת השער */}
      <path d="M4 54V22C4 11.5 12.9 3 24 3s20 8.5 20 19v32" strokeWidth="1.6" />
      {/* קרני אור מעל הספר */}
      <path d="M24 15v-4M16.5 17.5 14 14M31.5 17.5 34 14" strokeWidth="1.4" strokeLinecap="round" />
      {/* ספר פתוח */}
      <path
        d="M24 26c-3.2-2.4-7.4-3.4-11.5-3v16c4.1-.4 8.3.6 11.5 3 3.2-2.4 7.4-3.4 11.5-3V23c-4.1-.4-8.3.6-11.5 3Z"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M24 26v16" strokeWidth="1.4" />
    </svg>
  );
}
