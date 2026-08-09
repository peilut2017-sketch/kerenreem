'use client';

import { useState, type ReactNode } from 'react';
import { BookCover } from '@/components/BookCover';
import { getBookAvailability } from '@/lib/books/availability';
import { formatPrice, getEffectivePrice } from '@/lib/commerce/pricing';

export interface BookPreviewInitial {
  price: number | null;
  salePrice: number | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  saleName: string | null;
  isPurchasable: boolean;
  preorderEnabled: boolean;
  preorderReleaseDate: string | null;
  stockQuantity: number;
  prepDaysOverride: number | null;
}

function formatReleaseDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('he-IL', { dateStyle: 'long' }).format(date);
}

/**
 * [1.5] "כך ייראה הספר בחנות" — תצוגה מקדימה חיה בטופס הספר (ביקורת ג.9).
 * השדות עצמם נשארים בלתי-מבוקרים (defaultValue, לא value) כדי לא לגעת
 * בהתנהגות השמירה או במנגנון "לשוניות נשארות ב-DOM כדי לא לאבד ערכים";
 * התצוגה המקדימה רק מאזינה לאירועי change שמבעבעים מהם ומעדכנת state
 * נפרד משלה. חישוב המחיר/הזמינות עצמם — getEffectivePrice/getBookAvailability
 * הקיימים, לא לוגיקה כפולה, כדי שהתצוגה תמיד תסכים עם מה שהלקוח באמת יראה.
 */
export function BookStorePreview({
  coverUrl,
  title,
  storeEnabled,
  initial,
  children,
}: {
  coverUrl: string | null | undefined;
  title: string;
  storeEnabled: boolean;
  initial: BookPreviewInitial;
  children: ReactNode;
}) {
  const [state, setState] = useState(initial);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, checked, type } = event.target;
    setState((current) => {
      switch (name) {
        case 'price':
          return { ...current, price: value === '' ? null : Number(value) };
        case 'sale_price':
          return { ...current, salePrice: value === '' ? null : Number(value) };
        case 'sale_starts_at':
          return { ...current, saleStartsAt: value || null };
        case 'sale_ends_at':
          return { ...current, saleEndsAt: value || null };
        case 'sale_name_he':
          return { ...current, saleName: value || null };
        case 'is_purchasable':
          return type === 'checkbox' ? { ...current, isPurchasable: checked } : current;
        case 'preorder_enabled':
          return type === 'checkbox' ? { ...current, preorderEnabled: checked } : current;
        case 'preorder_release_date':
          return { ...current, preorderReleaseDate: value || null };
        default:
          return current;
      }
    });
  }

  const effective =
    state.price != null
      ? getEffectivePrice({
          price: state.price,
          sale_price: state.salePrice,
          sale_starts_at: state.saleStartsAt,
          sale_ends_at: state.saleEndsAt,
          sale_name_he: state.saleName,
          sale_name_en: null,
        })
      : null;

  const availability = getBookAvailability(
    {
      is_purchasable: state.isPurchasable,
      price: state.price,
      stock_quantity: state.stockQuantity,
      preorder_enabled: state.preorderEnabled,
    },
    storeEnabled,
  );

  return (
    // onChange מבעבע לכאן מכל שדה צאצא (סינתטי — React, לא אירוע native על ה-div עצמו)
    <div onChange={handleChange}>
      <div className="admin-card mb-6 overflow-hidden">
        <p className="border-b border-rule bg-cream-2 px-4 py-2 text-caption font-semibold text-ink-soft">
          כך ייראה הספר בחנות{storeEnabled ? '' : ' — החנות כבויה כרגע באתר'}
        </p>
        <div className="flex items-center gap-4 p-4">
          <div className="w-14 shrink-0">
            <BookCover src={coverUrl} title={title || 'ללא שם'} alt="" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-small font-semibold text-ink">{title || 'ללא שם'}</p>

            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {effective ? (
                <span className="inline-flex items-baseline gap-1.5 font-serif text-[1.05rem] text-ink tabular-nums">
                  {effective.onSale && effective.originalAmount != null ? (
                    <s className="text-caption text-muted">{formatPrice(effective.originalAmount, 'he')}</s>
                  ) : null}
                  {formatPrice(effective.amount, 'he')}
                </span>
              ) : (
                <span className="text-caption text-muted">לא מוצג מחיר בחנות</span>
              )}
              {effective?.onSale && state.saleName ? (
                <span className="admin-badge admin-badge-accent">{state.saleName}</span>
              ) : null}
            </div>

            <p className="mt-1.5 text-caption">
              {availability === 'catalog_only' ? (
                <span className="text-muted">כרטיס קטלוג בלבד — בלי כפתור רכישה</span>
              ) : availability === 'out_of_stock' ? (
                <span className="font-semibold text-[var(--admin-danger)]">אזל מן המלאי</span>
              ) : availability === 'preorder' ? (
                <span className="text-[var(--admin-accent)]">
                  הזמנה מראש
                  {state.preorderReleaseDate ? ` — צפוי לצאת לאור ב-${formatReleaseDate(state.preorderReleaseDate)}` : ''}
                </span>
              ) : (
                <span className="text-[var(--admin-success)]">במלאי — ניתן להוספה לסל</span>
              )}
            </p>

            {state.prepDaysOverride ? (
              <p className="mt-1 text-caption text-muted">
                זמן הכנה מותאם לספר זה: {state.prepDaysOverride} ימי עסקים (מעבר לזמן ההכנה הרגיל של החנות)
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
