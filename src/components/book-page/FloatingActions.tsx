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
      className={`on-dark fixed bottom-6 end-6 z-40 flex flex-col gap-1.5 rounded-[var(--radius-lg)] bg-navy p-2.5 shadow-[var(--shadow-float)] transition-all duration-500 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      {showBuy ? (
        <button
          type="button"
          onClick={() => document.getElementById('book-purchase')?.scrollIntoView({ behavior: 'smooth' })}
          className="rounded-[var(--radius-md)] bg-gold px-4 py-2.5 text-small text-navy transition-colors hover:bg-gold-bright"
        >
          {t('addToCart')}
        </button>
      ) : null}
      <button
        type="button"
        aria-pressed={isFavourite}
        onClick={() => toggle(bookId)}
        className={`rounded-[var(--radius-md)] px-3 py-2 text-caption transition-colors hover:text-gold-bright ${
          isFavourite ? 'text-gold-bright' : 'text-cream-2/75'
        }`}
      >
        {isFavourite ? t('favouriteRemove') : t('favouriteAdd')}
      </button>
      <button
        type="button"
        onClick={() => void share()}
        className="relative rounded-[var(--radius-md)] px-3 py-2 text-caption text-cream-2/75 transition-colors hover:text-gold-bright"
      >
        {t('share')}
        {copied ? (
          <span className="absolute bottom-full end-0 mb-2 whitespace-nowrap rounded-[var(--radius-sm)] bg-ink px-2.5 py-1 text-caption text-cream">
            {t('shareCopied')}
          </span>
        ) : null}
      </button>
    </div>
  );
}
