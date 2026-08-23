import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

/**
 * כותרת מקטע בתוך עמוד: תווית־על, כותרת בסריף, וקו שיער בזהב שממשיך עד
 * קצה השורה. המוטיב לקוח משער של ספר — הקו הוא מה שמפריד, לא רקע צבעוני
 * ולא כרטיס.
 */
export function SectionHeading({
  eyebrow,
  title,
  action,
  level = 2,
  id,
}: {
  eyebrow?: string;
  title: ReactNode;
  action?: { href: string; label: string };
  level?: 2 | 3;
  id?: string;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';
  const size = level === 2 ? 'text-h2' : 'text-h3';

  return (
    <div className="mb-9">
      {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
      <div className="flex items-baseline gap-5">
        {/* scroll-mt: כותרת עם id היא בדרך כלל יעד קפיצה מניווט פנימי;
            בלעדיו סרגל ניווט דביק היה מכסה אותה אחרי הקפיצה. משתמש
            ב---book-nav-offset כשהוא מוגדר (עמוד הספר, ראו StickyNav.tsx),
            אחרת נופל לערך קבוע סביר */}
        <Heading
          id={id}
          className={`${size} shrink-0 font-serif text-ink ${id ? 'scroll-mt-[var(--book-nav-offset,6rem)]' : ''}`}
        >
          {title}
        </Heading>
        {/* הזהב יוצא מהכותרת ודועך אל הקצה — כיוון הדעיכה מתהפך עם כיוון
            הקריאה: גרדיאנט פיזי קבוע הציב באנגלית את הזהב בקצה הרחוק
            והשקוף דווקא ליד הכותרת. */}
        <span
          aria-hidden="true"
          className="h-px flex-1 translate-y-[-0.35em] bg-linear-to-l from-gold to-transparent ltr:bg-linear-to-r"
        />
        {action ? (
          <Link href={action.href} className="link-more shrink-0">
            {action.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
