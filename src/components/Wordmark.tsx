import { Link } from '@/i18n/navigation';

/**
 * סמל הקרן ושמה.
 *
 * כשהועלה לוגו ב-CMS הוא מוצג. עד אז מוצג סימן שנגזר מהלוגו — קשת של
 * שער בית מדרש עם ספר פתוח וקרני אור, בזהב. הוא בנוי כ-SVG inline כדי
 * שיירש את הצבע מהרקע: זהב על כהה, ודיו על נייר.
 */
export function Wordmark({
  logoUrl,
  name,
  tagline,
  variant = 'light',
  compact = false,
}: {
  logoUrl: string | null;
  name: string;
  tagline?: string;
  /** 'light' — על נייר, 'dark' — על הכחול העמוק */
  variant?: 'light' | 'dark';
  /** גרסה מכווצת — לוגו וטקסט קטנים יותר, לניווט במצב צף */
  compact?: boolean;
}) {
  return (
    <Link
      href="/"
      className="group flex items-center gap-3 transition-[gap] duration-[420ms] ease-[var(--ease-spring)] focus-visible:outline-offset-4 motion-reduce:transition-none"
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- הלוגו מוגדר ב-CMS ומוגש כפי שהוא
        <img
          src={logoUrl}
          alt={name}
          className={`w-auto transition-[height] duration-[420ms] ease-[var(--ease-spring)] motion-reduce:transition-none ${
            compact ? 'h-8 sm:h-9' : 'h-11 sm:h-12'
          }`}
        />
      ) : (
        <MarkSvg
          compact={compact}
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

function MarkSvg({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  return (
    <svg
      viewBox="0 0 48 56"
      className={`w-auto shrink-0 transition-[height] duration-[420ms] ease-[var(--ease-spring)] motion-reduce:transition-none ${
        compact ? 'h-8 sm:h-9' : 'h-11 sm:h-12'
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
