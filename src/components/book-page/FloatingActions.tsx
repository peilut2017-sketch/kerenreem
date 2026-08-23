'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocalList } from '@/lib/client-hooks';
import { useCart } from '../store/CartProvider';
import { AddToCartButton } from '../store/AddToCartButton';
import type { BookAvailability } from '@/lib/supabase/types';

/**
 * סרגל רכישה דביק — מופיע רק כשיש בכלל מה לקנות.
 *
 * כשהחנות כבויה או שהספר אינו ניתן לרכישה, אין להציג סרגל קבוע רק בשביל
 * מועדפים ושיתוף (סעיף 24 במפרט): שתי הפעולות האלה כבר זמינות תמיד
 * ב-Hero (BookHeroActions), וסרגל צף שמופיע בלי סיבה נראה כמו תקלה.
 * לכן הרכיב מחזיר null מוקדם כש-showBuy הוא false — לא רק מסתיר את
 * כפתור הקנייה מתוכו.
 *
 * "קנייה" גולל אל גוש הרכישה הקיים ב-Hero במקום לשכפל את לוגיקת
 * המחיר/המלאי שלו; אין כאן עדיין עגלת קניות אמיתית לשכפל בכלל.
 *
 * useTranslations ולא t כ-prop: רכיב לקוח אמיתי, ו-t שנוצר בשרת אינו
 * ניתן להעברה כ-prop לרכיב כזה (React זורק בזמן ריצה, לא רק אזהרת טיפוסים).
 */
export function FloatingActions({
  bookId,
  title,
  price,
  showBuy,
  availability,
}: {
  bookId: string;
  title: string;
  /** מחיר מעוצב מראש — הרכיב אינו מעצב מטבע בעצמו. */
  price: string | null;
  showBuy: boolean;
  /**
   * [1.4] בעבר הכפתור כאן קרא cart.add() ישירות בלי לדעת זמינות בכלל —
   * ספר שאזל קיבל כפתור "הוספה לסל" פעיל, האימות בשרת דחה אותו אחר כך
   * בשקט (removedReason: 'out_of_stock'), והלקוח גילה בעגלה שהספר נעלם.
   * עכשיו זה אותו <AddToCartButton> שמטפל נכון בארבעת מצבי הזמינות.
   */
  availability: BookAvailability;
}) {
  const t = useTranslations('books');
  const cart = useCart();
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const { has, toggle } = useLocalList('kr:favourites');
  const isFavourite = has(bookId);

  useEffect(() => {
    if (!showBuy || typeof IntersectionObserver === 'undefined') return;

    // מוסתר גם ב-Hero (איפה שהמחיר כבר מוצג) וגם באזור הסיום (איפה
    // שהוא מוצג שוב) — לא רק בראש העמוד.
    const hero = document.getElementById('book-hero');
    const finalCta = document.getElementById('book-final-cta');
    const targets = [hero, finalCta].filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const intersecting = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) intersecting.add(entry.target);
        else intersecting.delete(entry.target);
      });
      setVisible(intersecting.size === 0);
    });
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [showBuy]);

  if (!showBuy) return null;

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
      // bottom מפנה מקום לרצועת הסכמת העוגיות (--consent-h): בביקור
      // הראשון — בדיוק כשהרצועה מוצגת — הסרגל הזה הוא כפתור הרכישה,
      // ואסור שיוסתר מאחוריה.
      className={`on-dark fixed bottom-[calc(1.5rem+var(--consent-h,0px))] end-6 z-40 flex flex-col gap-1.5 rounded-[var(--radius-lg)] bg-navy p-2.5 shadow-[var(--shadow-float)] transition-all duration-500 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      {price ? (
        <p className="px-3 pt-1 text-caption text-cream-2/75">
          <span className="block max-w-40 truncate">{title}</span>
          <span className="font-serif text-small text-cream">{price}</span>
        </p>
      ) : null}
      {cart?.enabled ? (
        <AddToCartButton
          bookId={bookId}
          title={title}
          availability={availability}
          variant="solid"
          className="w-full justify-center text-center"
        />
      ) : (
        // העגלה כבויה כדגל — אין מה להוסיף; גלילה לגוש הרכישה האמיתי ב-Hero
        // (הוא זה שמטפל נכון בזמינות כשהעגלה כבויה, לא משוכפל כאן)
        <button
          type="button"
          onClick={() => document.getElementById('book-purchase')?.scrollIntoView({ behavior: 'smooth' })}
          className="rounded-[var(--radius-md)] bg-gold px-4 py-2.5 text-small text-navy transition-colors hover:bg-gold-bright"
        >
          {t('addToCart')}
        </button>
      )}
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
