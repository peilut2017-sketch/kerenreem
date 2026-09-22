import { Link } from '@/i18n/navigation';
import { toCdnUrl } from '@/lib/image-src';

/**
 * סמל הקרן ושמה.
 *
 * כשהועלה לוגו ב-CMS הוא מוצג. עד אז מוצג סימן שנגזר מהלוגו — קשת של
 * שער בית מדרש עם ספר פתוח וקרני אור, בזהב. הוא בנוי כ-SVG inline כדי
 * שיירש את הצבע מהרקע: זהב על כהה, ודיו על נייר.
 *
 * [1.40] הסמל גדול משורת הכותרת וגולש מתחתיה. מרווחי הכותרת נשארים
 * כפי שהם (py-5 במצב היציב) והסמל מקבל שוליים תחתונים שליליים — כך
 * הוא נראה גדול ובולט, אבל *אינו* מגביה את הפס ואינו מזיז את התוכן
 * שמתחתיו. הגלישה אפשרית משום שאין overflow:hidden על משטח הכותרת;
 * z-10 מוודא שהחלק הגולש נמצא מעל התוכן שמתחת ולא נחתך על ידו.
 *
 * במסכים צרים (מתחת ל-sm) ההגדלה מתונה יותר: שם הפס עצמו צר, וסמל
 * שגולש הרבה היה מתנגש בתפריט ההמבורגר ובכפתורי המסחר שלצדו.
 */

/**
 * גובה הסמל וגלישתו, לפי מצב הכותרת. שתי המחרוזות מופיעות פעמיים
 * (תמונה שהועלתה, ו-SVG ברירת המחדל) ולכן הן קבוע אחד ולא ערך כפול.
 */
const LOGO_HEIGHT = {
  full: 'h-16 sm:h-[5.5rem] lg:h-[6.25rem]',
  compact: 'h-11 sm:h-14',
} as const;

/**
 * הגלישה עצמה, כשוליים תחתונים שליליים. נפרדת מהגובה כי היא רצויה רק
 * בכותרת האתר: בכותרת התחתונה הלוגו יושב מעל פסקת טקסט, ושוליים
 * שליליים שם היו מושכים את הפסקה אל תוכו.
 */
const LOGO_OVERHANG = {
  full: '-mb-4 sm:-mb-7 lg:-mb-9',
  compact: '-mb-2 sm:-mb-3.5',
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
  const logoSize = `${LOGO_HEIGHT[key]} ${overhang ? LOGO_OVERHANG[key] : ''}`;

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
