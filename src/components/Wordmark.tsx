import { Link } from '@/i18n/navigation';
import { toCdnUrl } from '@/lib/image-src';

/**
 * סמל הקרן ושמה.
 *
 * כשהועלה לוגו ב-CMS הוא מוצג. עד אז מוצג סימן שנגזר מהלוגו — קשת של
 * שער בית מדרש עם ספר פתוח וקרני אור, בזהב. הוא בנוי כ-SVG inline כדי
 * שיירש את הצבע מהרקע: זהב על כהה, ודיו על נייר.
 *
 * [1.40] הסמל גדול משורת הכותרת ובולט אל מחוץ לה — גם מהפס היציב
 * בראש העמוד וגם מקפסולת הזכוכית הצפה שבגלילה — **בלי להגדיל את
 * הכותרת ולו בפיקסל אחד**.
 *
 * איך זה עובד, ולמה דווקא כך:
 *
 * גובה שורת flex נקבע לפי *קופסת השוליים* (margin box) של הילדים,
 * לא לפי גובהם הנראה. שוליים תחתונים שליליים מקצרים את קופסת השוליים
 * בלי לגעת בתמונה עצמה — ולכן הסמל נשאר גדול לעין בעוד שמבחינת
 * הפריסה הוא תופס בדיוק את הגובה שתפס קודם.
 *
 * מכאן האילוץ שכל הערכים כאן מקיימים:
 *
 *     גובה נראה − גלישה = הגובה השמור (RESERVED)
 *
 * והגובה השמור הוא בדיוק הגובה שהסמל תפס לפני ההגדלה. כל עוד המשוואה
 * מתקיימת, הכותרת אינה יכולה לגדול.
 *
 * למה *לא* transform: scale — הוא אמנם גם אינו משפיע על הפריסה, אבל
 * הוא מותח תמונה שכבר נצרבה בגודל הקטן, והתוצאה מטושטשת. שוליים
 * שליליים משאירים את התמונה ברזולוציה המלאה שלה.
 *
 * למה רק כלפי מטה ולא גם למעלה — הכותרת דביקה ב-top:0, וחלק שגולש
 * כלפי מעלה פשוט נחתך בקצה החלון.
 *
 * הגלישה אפשרית משום שאין overflow:hidden על משטח הכותרת, ו-z-10 על
 * הקישור מוודא שהחלק הבולט נמצא *מעל* התוכן שמתחת ולא נחתך על ידו.
 */

/**
 * הגובה שהסמל תופס בפריסה — זהה למידות שהיו לפני ההגדלה, ולכן
 * הכותרת נשארת בגובהה המקורי. מוצג כאן לתיעוד האילוץ שלמטה; הוא
 * אינו נצרך כמחלקה בפני עצמו.
 *
 *   full:    2.75rem (בסיס) · 3rem (sm ומעלה)
 *   compact: 2rem    (בסיס) · 2.25rem (sm ומעלה)
 */

/** הגובה הנראה של הסמל. */
const LOGO_HEIGHT = {
  full: 'h-[5.25rem] sm:h-[5.5rem] lg:h-[6rem]',
  compact: 'h-[3.75rem] sm:h-[4.25rem]',
} as const;

/**
 * הגלישה: שוליים תחתונים שליליים, בדיוק ההפרש בין הגובה הנראה לגובה
 * השמור (ראו האילוץ בתיעוד למעלה).
 *
 *   full    בסיס : 5.25rem − 2.5rem  = 2.75rem ✓
 *   full    sm    : 5.5rem  − 2.5rem  = 3rem    ✓
 *   full    lg    : 6rem    − 3rem    = 3rem    ✓
 *   compact בסיס : 3.75rem − 1.75rem = 2rem    ✓
 *   compact sm    : 4.25rem − 2rem    = 2.25rem ✓
 *
 * הגלישה גדולה מהריפוד התחתון של הכותרת (py-5 ביציב, py-2.5 בצף),
 * ולכן הסמל באמת יוצא אל מחוץ למסגרת ולא רק ממלא אותה.
 *
 * נפרדת מהגובה כי היא רצויה רק בכותרת האתר: בכותרת התחתונה הסמל יושב
 * מעל פסקת טקסט, ושוליים שליליים שם היו מושכים את הפסקה אל תוכו.
 */
const LOGO_OVERHANG = {
  full: '-mb-10 lg:-mb-12',
  compact: '-mb-7 sm:-mb-8',
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
  const logoSize = `max-w-[46vw] sm:max-w-[20rem] ${LOGO_HEIGHT[key]} ${overhang ? LOGO_OVERHANG[key] : ''}`;

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
            className={`w-auto shrink-0 object-contain transition-[height,margin] duration-[420ms] ease-[var(--ease-spring)] motion-reduce:transition-none ${logoSize}`}
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
        LOGO_HEIGHT[key]
      } ${overhang ? LOGO_OVERHANG[key] : ''} ${className}`}
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
