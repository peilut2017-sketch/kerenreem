'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocalList } from '@/lib/client-hooks';

/**
 * כפתור פעולה צף שמופיע אחרי גלילה מעבר ל-Hero: אהבתי, שיתוף, וקנייה
 * (רק כשהחנות פעילה והספר ניתן לרכישה) — לא תפריט, שלוש פעולות בלבד.
 *
 * "קנייה" גולל אל גוש הרכישה הקיים (BookPurchase) במקום לשכפל את לוגיקת
 * המחיר/המלאי שלו; אין כאן עדיין עגלת קניות אמיתית לשכפל בכלל.
 *
 * useTranslations ולא t כ-prop: רכיב לקוח אמיתי, ו-t שנוצר בשרת אינו
 * ניתן להעברה כ-prop לרכיב כזה (React זורק בזמן ריצה, לא רק אזהרת טיפוסים).
 */
export function FloatingActions({
  bookId,
  title,
  showBuy,
}: {
  bookId: string;
  title: string;
  showBuy: boolean;
}) {
  const t = useTranslations('books');
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const { has, toggle } = useLocalList('kr:favourites');
  const isFavourite = has(bookId);

  useEffect(() => {
    const hero = document.getElementById('book-hero');
    if (!hero || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting));
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // המשתמש ביטל את חלון השיתוף — לא שגיאה שצריך להציג
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* אין clipboard API זמין — אין מה לעשות בלי דרך נוספת להעתיק */
    }
  }

  return (
    <div
      className={`fixed bottom-6 left-1/2 z-40 -translate-x-1/2 transition-all duration-500 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <div className="glass flex items-center gap-1 rounded-[var(--radius-pill)] p-1.5 shadow-[var(--shadow-float)]">
        {showBuy ? (
          <button
            type="button"
            onClick={() => document.getElementById('book-purchase')?.scrollIntoView({ behavior: 'smooth' })}
            className="rounded-[var(--radius-pill)] bg-burgundy px-5 py-2 text-small text-white transition-colors hover:bg-burgundy-deep"
          >
            {t('addToCart')}
          </button>
        ) : null}
        <button
          type="button"
          aria-pressed={isFavourite}
          aria-label={isFavourite ? t('favouriteRemove') : t('favouriteAdd')}
          onClick={() => toggle(bookId)}
          className="rounded-[var(--radius-pill)] p-2.5 text-ink-soft transition-colors hover:text-burgundy"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill={isFavourite ? 'currentColor' : 'none'}>
            <path
              d="M12 20.5s-7.5-4.6-10-9.1C.5 8 2 4.5 5.5 4a5 5 0 0 1 6.5 2 5 5 0 0 1 6.5-2c3.5.5 5 4 3.5 7.4-2.5 4.5-10 9.1-10 9.1Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => void share()}
          aria-label={t('share')}
          className="relative rounded-[var(--radius-pill)] p-2.5 text-ink-soft transition-colors hover:text-burgundy"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none">
            <path
              d="M8.5 11.5v6a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-6M12 3v11m0-11-3.5 3.5M12 3l3.5 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {copied ? (
            <span className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-sm)] bg-ink px-2.5 py-1 text-caption text-cream">
              {t('shareCopied')}
            </span>
          ) : null}
        </button>
      </div>
    </div>
  );
}
