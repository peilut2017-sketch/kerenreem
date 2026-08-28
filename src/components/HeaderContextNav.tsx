'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import type { ContextNavValue } from './header-context-nav';

/**
 * [1.30] ניווט הקשרי בתוך קפסולת הכותרת הצפה — שלבי אירוע/מקטעי ספר
 * שהעמוד הנוכחי פרסם (usePublishHeaderContextNav). מופרד מהניווט
 * הראשי בקו דק ובצבע פעיל שונה (בורדו, כמו EventJourneyProgress/
 * StickyNav הישנים) כדי שברור מה שייך לעמוד ומה לניווט הראשי של האתר.
 *
 * [1.34] כל השלבים מקבלים לחצן — לא עוד "חלון" מצומצם סביב הפעיל:
 * בתצוגת אירוע כל שלב במסע צריך אפשרות מעבר מהיר ישיר, גם כשהוא רחוק
 * מהשלב הנוכחי. כדי שרשימה ארוכה לא תפוצץ את הקפסולה (היא חולקת מקום
 * עם הלוגו, הניווט הראשי ופעולות הצד), הרצועה מוגבלת ברוחב וגלילה
 * אופקית בתוכה, והשלב הפעיל מובא אוטומטית אל טווח הראייה עם הגלילה
 * בעמוד — אותה תבנית כמו HeaderContextNavMobile, רק בתוך שורת הכותרת.
 */
export function HeaderContextNav({ items, activeId, onSelect }: ContextNavValue) {
  const t = useTranslations('nav');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>('[aria-current="true"]');
    // גלילה פנימית של הרצועה בלבד — scrollIntoView על העמוד היה מזיז
    // גם את הגלילה האנכית של המסמך בזמן שהמשתמש קורא.
    if (active) {
      const target = active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2;
      list.scrollTo({ left: target, behavior: 'smooth' });
    }
  }, [activeId]);

  return (
    <div
      ref={listRef}
      role="list"
      aria-label={t('pageNavigation')}
      className="hidden max-w-[26rem] items-center gap-0.5 overflow-x-auto border-s border-rule ps-3 [scrollbar-width:none] lg:flex"
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={active ? 'true' : undefined}
            title={item.label}
            className={`max-w-32 shrink-0 truncate whitespace-nowrap rounded-[var(--radius-pill)] px-2.5 py-1 text-caption transition-colors duration-200 ${
              active
                ? 'bg-burgundy/10 font-semibold text-burgundy'
                : 'text-ink-soft hover:bg-cream-2 hover:text-burgundy'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
