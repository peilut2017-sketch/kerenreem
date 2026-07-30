import { SectionHeading } from '@/components/SectionHeading';
import { RichText } from '@/components/RichText';

/**
 * התקציר ככרטיס צף, לא כבלוק טקסט שנשפך ישירות על הרקע — מסגרת עדינה
 * וצל רך, כמו שאר הכרטיסים בעמוד.
 */
export function SummaryCard({ html, t }: { html: string; t: (key: string) => string }) {
  return (
    <section aria-labelledby="book-summary">
      <SectionHeading level={2} title={t('navSummary')} id="book-summary" />
      <div className="rounded-[var(--radius-lg)] border border-rule bg-cream px-6 py-7 shadow-[var(--shadow-soft)] sm:px-9 sm:py-9">
        <RichText html={html} />
      </div>
    </section>
  );
}
