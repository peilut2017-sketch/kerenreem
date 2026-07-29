import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

/**
 * הכותרת החוזרת של האתר: תווית־על קטנה, כותרת בסריף, וקו שיער שממשיך
 * עד קצה השורה. המוטיב לקוח משער של ספר — הקו הוא מה שמפריד, לא רקע
 * צבעוני ולא כרטיס.
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
    <div className="mb-8">
      {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
      <div className="flex items-baseline gap-5">
        <Heading id={id} className={`${size} shrink-0 text-ink`}>
          {title}
        </Heading>
        <span aria-hidden="true" className="h-px flex-1 translate-y-[-0.35em] bg-rule" />
        {action ? (
          <Link href={action.href} className="link shrink-0 text-small text-muted">
            {action.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
