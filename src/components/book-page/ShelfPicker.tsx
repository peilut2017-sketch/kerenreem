'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocalMap } from '@/lib/client-hooks';
import { Drawer } from '../Drawer';

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
 *
 * [1.6] bottom-sheet (ח.18) על גבי ה-Drawer המשותף, במקום פופאובר עצמאי:
 * לצד ההתאמה למובייל מקבלים גם לכידת מיקוד/Escape/רקע בחינם — אף אחד
 * מהם לא היה קיים בפופאובר הידני הקודם, בכל רוחב מסך.
 */
export function ShelfPicker({ bookId }: { bookId: string }) {
  const t = useTranslations('books');
  const [open, setOpen] = useState(false);
  const { get, set } = useLocalMap('kr:shelf');
  const current = get(bookId);
  const titleId = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`btn btn-quiet inline-flex items-center gap-2 ${current ? 'text-gold-deep' : ''}`}
      >
        {current && SHELF_LABELS[current] ? t('shelfCurrent', { label: t(SHELF_LABELS[current]) }) : t('shelfAdd')}
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        titleId={titleId}
        title={t('shelfAdd')}
        closeLabel={t('close')}
        variant="bottom"
        widthClassName="max-w-sm"
      >
        <div role="radiogroup" aria-label={t('shelfAdd')} className="flex flex-col gap-1">
          {SHELVES.map((shelf) => (
            <button
              key={shelf.key}
              type="button"
              role="radio"
              aria-checked={current === shelf.key}
              onClick={() => {
                set(bookId, shelf.key);
                setOpen(false);
              }}
              className={`rounded-[var(--radius-md)] px-4 py-3 text-start text-body transition-colors ${
                current === shelf.key ? 'bg-cream-3 font-semibold text-ink' : 'text-ink-soft hover:bg-cream-2'
              }`}
            >
              {t(shelf.label)}
            </button>
          ))}
        </div>
      </Drawer>
    </>
  );
}
