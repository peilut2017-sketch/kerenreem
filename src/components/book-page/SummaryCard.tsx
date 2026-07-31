'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { RichText } from '@/components/RichText';

/**
 * גוף התקציר, עם מתג "קריאה רגילה / תמצית ב-30 שניות" כשיש תמצית קצרה.
 * בלי תמצית קצרה (description_brief_he ריק) אין מתג בכלל — התיאור המלא
 * מוצג לבד, כמו קודם. מתג שקופץ בין שני מצבים כשיש רק אחד הוא רעש.
 */
export function SummaryCard({ html, brief }: { html: string; brief?: string | null }) {
  const t = useTranslations('books');
  const [mode, setMode] = useState<'full' | 'brief'>('full');

  if (!brief) return <RichText html={html} />;

  return (
    <div>
      <div role="group" aria-label={t('summaryModeGroup')} className="mb-5 inline-flex rounded-[var(--radius-pill)] bg-cream-2 p-1">
        <button
          type="button"
          aria-pressed={mode === 'full'}
          onClick={() => setMode('full')}
          className={`rounded-[var(--radius-pill)] px-3.5 py-1.5 text-caption transition-colors ${
            mode === 'full' ? 'bg-navy text-cream' : 'text-muted hover:text-ink'
          }`}
        >
          {t('summaryFull')}
        </button>
        <button
          type="button"
          aria-pressed={mode === 'brief'}
          onClick={() => setMode('brief')}
          className={`rounded-[var(--radius-pill)] px-3.5 py-1.5 text-caption transition-colors ${
            mode === 'brief' ? 'bg-navy text-cream' : 'text-muted hover:text-ink'
          }`}
        >
          {t('summaryBrief')}
        </button>
      </div>

      {mode === 'full' ? <RichText html={html} /> : <p className="text-body leading-relaxed text-ink-soft">{brief}</p>}
    </div>
  );
}
