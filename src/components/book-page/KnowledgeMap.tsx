'use client';

import { useTranslations } from 'next-intl';
import { SectionHeading } from '@/components/SectionHeading';

export interface KnowledgeMapNode {
  id: string;
  label: string;
  count: number;
}

/**
 * מרחב הידע — לא "עוד ספרים" בתחתית העמוד, אלא מפה סטטית שממחישה איך
 * הספר יושב בתוך הקטלוג: מחבר, נושא, סדרה ותגיות, כל אחד עם מספר
 * הספרים שהוא מוביל אליהם. לחיצה על ענף גוללת אל הקרוסלה שלו.
 *
 * במכוון לא Discovery Graph דינמי עם פיזיקה וגרירה: אין כאן ספריית
 * גרפים, וכל הנתונים שמוצגים אמיתיים — לא ניחוש שמוצג כעובדה (ראו
 * ההערה בתחתית 10_book_page_stage_c.sql על "נקנו יחד").
 *
 * useTranslations ולא t כ-prop: זהו רכיב לקוח אמיתי, ופונקציה שנוצרה
 * בשרת אי אפשר להעביר אליו — React זורק עליה בזמן ריצה ("Functions
 * cannot be passed directly to Client Components").
 */
export function KnowledgeMap({ nodes }: { nodes: KnowledgeMapNode[] }) {
  const t = useTranslations('books');
  const visible = nodes.filter((node) => node.count > 0);
  if (visible.length === 0) return null;

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <section aria-labelledby="book-knowledge-map">
      <SectionHeading level={2} title={t('navKnowledgeMap')} id="book-knowledge-map" />
      <div className="flex flex-col items-center gap-6">
        <span className="rounded-[var(--radius-pill)] border border-burgundy px-5 py-2 font-serif text-small text-burgundy">
          {t('knowledgeMapIntro')}
        </span>
        <span aria-hidden="true" className="h-8 w-px bg-rule" />

        <div className="relative flex w-full max-w-3xl flex-wrap justify-center gap-x-10 gap-y-6">
          <span
            aria-hidden="true"
            className="absolute inset-x-10 top-0 hidden h-px bg-rule sm:block"
          />
          {visible.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => scrollToSection(node.id)}
              className="group relative flex flex-col items-center gap-2 pt-6"
            >
              <span aria-hidden="true" className="absolute top-0 h-6 w-px bg-rule" />
              <span className="rounded-[var(--radius-pill)] border border-rule bg-cream px-4 py-2 text-small text-ink-soft transition-colors group-hover:border-burgundy group-hover:text-burgundy">
                {node.label}
              </span>
              <span className="text-caption text-muted tabular-nums">{node.count}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
