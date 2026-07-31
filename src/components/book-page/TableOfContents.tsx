'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SectionHeading } from '@/components/SectionHeading';
import type { BookTocEntry } from '@/lib/supabase/types';

/**
 * תוכן עניינים כציר זמן, לא כרשימת טקסט. כל פרק הוא תחנה על הקו; לחיצה
 * פותחת תקציר קצר תחת התחנה, אם יש כזה — לא ניווט לעמוד אחר.
 *
 * useTranslations ולא t כ-prop: רכיב לקוח אמיתי, ו-t שנוצר בשרת אינו
 * ניתן להעברה כ-prop לרכיב כזה (React זורק בזמן ריצה, לא רק אזהרת טיפוסים).
 */
export function TableOfContents({ entries }: { entries: BookTocEntry[] }) {
  const t = useTranslations('books');
  const [openId, setOpenId] = useState<string | null>(null);
  const baseId = useId();

  if (entries.length === 0) return null;

  return (
    <section aria-labelledby="book-toc">
      <SectionHeading level={2} title={t('navToc')} id="book-toc" />
      <ol className="flex flex-col">
        {entries.map((entry) => {
          const open = openId === entry.id;
          const panelId = `${baseId}-${entry.id}`;
          return (
            <li key={entry.id} className="grid grid-cols-[3.5rem_1fr] gap-4 sm:grid-cols-[6rem_1fr] sm:gap-5">
              <div className="pt-4 text-end text-caption text-muted tabular-nums">
                {entry.page_number ? t('tocPage', { page: entry.page_number }) : null}
              </div>
              <div className={`relative border-s border-rule pb-2 ps-6 ${entry.level === 1 ? 'ms-3' : ''}`}>
                <span
                  aria-hidden="true"
                  className={`absolute -start-[0.4375rem] top-[1.15rem] h-[0.6875rem] w-[0.6875rem] rounded-full border-2 bg-cream ${
                    open ? 'border-gold-deep' : 'border-rule-strong'
                  }`}
                />
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenId(open ? null : entry.id)}
                  disabled={!entry.summary_he}
                  className={`block py-3 text-start font-serif text-ink ${
                    entry.level === 0 ? 'text-lead' : 'text-body'
                  } ${entry.summary_he ? 'transition-colors hover:text-gold-deep' : 'cursor-default'}`}
                >
                  {entry.title_he}
                </button>
                {entry.summary_he && open ? (
                  <p
                    id={panelId}
                    className="mb-4 max-w-prose rounded-[var(--radius-md)] bg-cream-2 px-5 py-4 text-small leading-relaxed text-ink-soft"
                  >
                    {entry.summary_he}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
