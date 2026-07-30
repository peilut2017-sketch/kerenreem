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
      <ol className="relative border-s-2 border-rule ps-6">
        {entries.map((entry) => {
          const open = openId === entry.id;
          const panelId = `${baseId}-${entry.id}`;
          return (
            <li key={entry.id} className={entry.level === 1 ? 'ms-4' : ''}>
              <div className="relative pb-6">
                <span
                  aria-hidden="true"
                  className="absolute -start-[1.7rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-gold bg-cream"
                />
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span
                    className={`font-serif text-ink ${entry.level === 0 ? 'text-lead' : 'text-body'}`}
                  >
                    {entry.title_he}
                  </span>
                  {entry.page_number ? (
                    <span className="text-caption text-muted tabular-nums">
                      {t('tocPage', { page: entry.page_number })}
                    </span>
                  ) : null}
                  {entry.summary_he ? (
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => setOpenId(open ? null : entry.id)}
                      className="text-caption text-burgundy underline underline-offset-4"
                    >
                      {open ? t('tocCollapse') : t('tocPreview')}
                    </button>
                  ) : null}
                </div>
                {entry.summary_he && open ? (
                  <p id={panelId} className="mt-2 max-w-prose text-small leading-relaxed text-ink-soft">
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
