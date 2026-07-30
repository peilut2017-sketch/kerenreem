import { SectionHeading } from '@/components/SectionHeading';
import { Reveal } from '@/components/Reveal';

/**
 * ציטוטים מתוך הספר, מוצגים כאילו הודפסו על קלף — לא כמרכאות בתוך
 * פסקה. כל ציטוט הוא כרטיס בפני עצמו, כי זה מה שנותן לו את המשקל
 * שציטוט ראוי לו.
 */
export function QuoteCards({ quotes, t }: { quotes: string[]; t: (key: string) => string }) {
  if (quotes.length === 0) return null;

  return (
    <section aria-labelledby="book-quotes">
      <SectionHeading level={2} title={t('quotes')} />
      <div className="grid gap-6 sm:grid-cols-2">
        {quotes.map((quote, index) => (
          <Reveal key={quote} delay={index * 80}>
            <figure
              className="relative rounded-[var(--radius-lg)] border border-rule bg-[linear-gradient(160deg,var(--color-cream-2),var(--color-cream-3))] px-7 py-8 shadow-[var(--shadow-soft)]"
            >
              <span
                aria-hidden="true"
                className="absolute right-5 top-3 font-serif text-[2.75rem] leading-none text-gold-deep/40"
              >
                &rdquo;
              </span>
              <blockquote className="font-serif text-lead leading-relaxed text-ink-soft">
                {quote}
              </blockquote>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
