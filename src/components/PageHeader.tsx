import { Ornament } from './Ornament';

/**
 * כותרת עמוד פנימי.
 *
 * מרוכזת, עם עיטור הזהב מתחת — אותו מוטיב שפותח כל מקטע מרכזי בעמוד
 * הבית, כדי שהמעבר בין העמודים יישאר באותה שפה.
 */
export function PageHeader({
  eyebrow,
  title,
  intro,
  align = 'center',
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  /** 'start' לעמודים שבהם הכותרת פותחת טור קריאה ולא מקטע */
  align?: 'center' | 'start';
}) {
  const centered = align === 'center';

  return (
    <header className={`${centered ? 'text-center' : ''} pb-2`}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1 className="mt-3 font-serif text-[clamp(1.75rem,3.8vw,2.5rem)] leading-tight text-ink">
        {title}
      </h1>
      <Ornament className={centered ? '' : '!justify-start'} />
      {intro ? (
        <p
          className={`mt-6 text-lead leading-relaxed text-muted ${
            centered ? 'mx-auto max-w-[58ch]' : 'max-w-[58ch]'
          }`}
        >
          {intro}
        </p>
      ) : null}
    </header>
  );
}
