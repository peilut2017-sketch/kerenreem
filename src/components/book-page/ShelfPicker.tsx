'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocalMap } from '@/lib/client-hooks';

const SHELVES = [
  { key: 'wantToRead', label: 'shelfWantToRead' },
  { key: 'wantToBuy', label: 'shelfWantToBuy' },
  { key: 'owned', label: 'shelfOwned' },
  { key: 'wantAsGift', label: 'shelfWantAsGift' },
] as const;

const SHELF_LABELS: Record<string, string> = Object.fromEntries(SHELVES.map((s) => [s.key, s.label]));

/**
 * "מדף אישי" — סיווג אישי לספר (לקרוא / לקנות / יש לי בבית / רוצה
 * במתנה), נשמר מקומית בדיוק כמו מועדפים ולא במסד: זה תיוג פרטי של
 * המבקר לעצמו, ולא נתון שהצוות צריך לראות או שדורש הזדהות.
 */
export function ShelfPicker({ bookId }: { bookId: string }) {
  const t = useTranslations('books');
  const [open, setOpen] = useState(false);
  const { get, set } = useLocalMap('kr:shelf');
  const current = get(bookId);
  const menuId = useId();

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={menuId}
        className={`btn btn-quiet inline-flex items-center gap-2 ${current ? 'text-gold-deep' : ''}`}
      >
        {current && SHELF_LABELS[current] ? t('shelfCurrent', { label: t(SHELF_LABELS[current]) }) : t('shelfAdd')}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute top-full z-20 mt-2 flex min-w-44 flex-col gap-1 rounded-[var(--radius-md)] border border-rule bg-cream p-1.5 shadow-[var(--shadow-float)] start-0"
        >
          {SHELVES.map((shelf) => (
            <button
              key={shelf.key}
              type="button"
              role="menuitemradio"
              aria-checked={current === shelf.key}
              onClick={() => {
                set(bookId, shelf.key);
                setOpen(false);
              }}
              className={`rounded-[var(--radius-sm)] px-3 py-2 text-start text-small transition-colors ${
                current === shelf.key ? 'bg-cream-3 text-ink' : 'text-ink-soft hover:bg-cream-2'
              }`}
            >
              {t(shelf.label)}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}
