'use client';

import { useId, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ContactForm } from './ContactForm';
import { BookFeedbackForm, type FeedbackBookOption } from './BookFeedbackForm';
import type { ContactField, ContactTopic } from '@/lib/supabase/types';

/**
 * [1.11] מערכת הפניות המחודשת — שני מסלולי פנייה בכרטיסיות:
 * פנייה כללית, והערות והארות על ספרים (עם בחירת ספר מהקטלוג).
 *
 * שתי הכרטיסיות נשארות ב-DOM (hidden ולא unmount) כדי שטקסט שהוקלד
 * באחת לא יימחק במעבר רגעי לשנייה — אותו עיקרון כמו BookFormTabs בניהול.
 */
export function ContactTabs({
  topics,
  fields,
  books,
}: {
  topics: ContactTopic[];
  fields: ContactField[];
  books: FeedbackBookOption[];
}) {
  const t = useTranslations('contact');
  const id = useId();

  // קישור עמוק מלחצן "דיווח על ספר" בעמוד הספר: ?tab=book פותח ישר את
  // כרטיסיית ההערות על ספרים, ו-?book=<id> בוחר מראש את הספר המדווח.
  // הקריאה בצד הלקוח (useSearchParams) ולא ב-page כדי שהעמוד יישאר סטטי.
  const searchParams = useSearchParams();
  const initialBookId = searchParams.get('book');
  const [active, setActive] = useState<'general' | 'book'>(
    searchParams.get('tab') === 'book' || initialBookId ? 'book' : 'general',
  );

  const tabs = [
    { key: 'general' as const, label: t('tabGeneral'), hint: t('tabGeneralHint') },
    { key: 'book' as const, label: t('tabBook'), hint: t('tabBookHint') },
  ];

  return (
    <div>
      <div role="tablist" aria-label={t('title')} className="mb-8 grid gap-3 sm:grid-cols-2">
        {tabs.map((tab) => {
          const selected = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`${id}-tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`${id}-panel-${tab.key}`}
              onClick={() => setActive(tab.key)}
              className={`rounded-[var(--radius-lg)] border p-4 text-start transition-all duration-300 ease-[var(--ease-spring)] motion-reduce:transition-none ${
                selected
                  ? 'border-burgundy bg-cream-2 shadow-[var(--shadow-card)]'
                  : 'border-rule bg-transparent hover:border-rule-strong hover:bg-cream-2/50'
              }`}
            >
              <span className={`block font-serif text-[1.0625rem] ${selected ? 'text-burgundy' : 'text-ink'}`}>
                {tab.label}
              </span>
              <span className="mt-1 block text-caption text-muted">{tab.hint}</span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${id}-panel-general`}
        aria-labelledby={`${id}-tab-general`}
        hidden={active !== 'general'}
      >
        <ContactForm topics={topics} fields={fields} />
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel-book`}
        aria-labelledby={`${id}-tab-book`}
        hidden={active !== 'book'}
      >
        <BookFeedbackForm books={books} defaultBookId={initialBookId} />
      </div>
    </div>
  );
}
