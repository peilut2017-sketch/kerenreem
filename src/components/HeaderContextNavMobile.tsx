'use client';

import { useTranslations } from 'next-intl';
import type { ContextNavValue } from './header-context-nav';

/**
 * [1.33] גרסת מובייל של הניווט ההקשרי — שורה שנייה בתוך אותה קפסולת
 * כותרת (לא חלון מצומצם כמו HeaderContextNav לדסקטופ, ראו שם): במסך
 * צר "חלון סביב הפריט הפעיל" פחות משמעותי מגלילה אופקית ישירה, תבנית
 * מוכרת ונגישה יותר במגע. בלי השורה הזו לא הייתה שום גישה לניווט
 * ההקשרי במובייל — הרכיב הדסקטופי מוסתר לגמרי מתחת ל-lg.
 */
export function HeaderContextNavMobile({ items, activeId, onSelect }: ContextNavValue) {
  const t = useTranslations('nav');

  return (
    <div
      role="list"
      aria-label={t('pageNavigation')}
      className="flex items-center gap-1.5 overflow-x-auto border-t border-rule/60 px-3 py-2 lg:hidden"
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={active ? 'true' : undefined}
            className={`shrink-0 whitespace-nowrap rounded-[var(--radius-pill)] px-3 py-1.5 text-caption transition-colors duration-200 ${
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
