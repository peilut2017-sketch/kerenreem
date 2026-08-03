'use client';

import { forwardRef } from 'react';

export interface PreviewPage {
  id: string;
  imageUrl: string;
  pageNumber: number;
}

/**
 * דף בודד בתוך הדפדוף.
 *
 * חייב להיות forwardRef עם אלמנט DOM אמיתי: StPageFlip אוסף את ילדי
 * המכל כאלמנטים ומודד אותם, ולכן רכיב שאינו מעביר ref החוצה פשוט לא
 * ייספר כדף.
 *
 * ה-img רגיל ולא next/image במכוון: הדפים כבר עברו המרה ל-WebP ברוחב
 * יעד קבוע בזמן ההפקה בניהול (ראו render-preview-pages.ts), כלומר
 * האופטימיזציה כבר נעשתה פעם אחת מראש. next/image כאן היה מוסיף סיבוב
 * עיבוד שני לכל דף בלי להקטין דבר.
 */
export const BookFlipPage = forwardRef<HTMLDivElement, { page: PreviewPage; label: string }>(
  function BookFlipPage({ page, label }, ref) {
    return (
      <div ref={ref} className="relative overflow-hidden bg-white shadow-inner">
        {/* eslint-disable-next-line @next/next/no-img-element -- נכס WebP שכבר עבר המרה בגודל יעד קבוע; ראו הערת הרכיב */}
        <img
          src={page.imageUrl}
          alt={label}
          loading={page.pageNumber <= 4 ? 'eager' : 'lazy'}
          className="h-full w-full object-contain"
        />

        {/* הצללת חיבור הדף לשדרה — פיזית, לא דקורטיבית: זה הצד שנכרך */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 start-0 w-[7%] bg-gradient-to-l from-black/[0.08] to-transparent"
        />
      </div>
    );
  },
);
