'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCart } from './CartProvider';
import { subscribeBackInStock } from '@/lib/commerce/back-in-stock-actions';
import type { BookAvailability } from '@/lib/supabase/types';

/**
 * כפתור ההוספה לסל האחד (פרק 2.1 במסמך האב) — מחליף את ארבעת הכפתורים
 * הדוממים. הזמינות מגיעה מהשרת (getBookAvailability) דרך העמוד; הרכיב
 * אינו מחשב זמינות ואינו מציג מחיר — רק פועל.
 *
 * כשהעגלה כבויה (הדגל השכבתי) הכפתור אינו מוצג כלל — התנהגות המתג
 * הקיימת נשמרת: מה שכבוי אינו קיים בעמוד, לא "מנוטרל".
 */
export function AddToCartButton({
  bookId,
  title,
  availability,
  variant = 'solid',
  className = '',
}: {
  bookId: string;
  title: string;
  availability: BookAvailability;
  variant?: 'solid' | 'quiet';
  className?: string;
}) {
  const t = useTranslations('books');
  const cart = useCart();

  if (!cart?.enabled || availability === 'catalog_only') return null;

  // [1.2] אזל מהמלאי — במקום כפתור מנוטרל: הרשמה לעדכון חזרה (פרק 16.4)
  if (availability === 'out_of_stock') {
    return <BackInStockSignup bookId={bookId} variant={variant} className={className} />;
  }

  const label = availability === 'preorder' ? t('addToCartPreorder') : t('addToCart');

  return (
    <button
      type="button"
      onClick={() => cart.add(bookId, title)}
      className={`btn ${variant === 'solid' ? 'btn-solid' : 'btn-quiet'} ${className}`}
    >
      {label}
    </button>
  );
}

function BackInStockSignup({
  bookId,
  variant,
  className,
}: {
  bookId: string;
  variant: 'solid' | 'quiet';
  className: string;
}) {
  const t = useTranslations('store');
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  if (state === 'done') {
    return (
      <p role="status" className={`text-small text-gold-deep ${className}`}>
        {t('backInStockDone')}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`btn ${variant === 'solid' ? 'btn-solid' : 'btn-quiet'} ${className}`}
      >
        {t('backInStockCta')}
      </button>
    );
  }

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setState('busy');
        try {
          const result = await subscribeBackInStock(bookId, email);
          setState(result.ok ? 'done' : 'error');
        } catch {
          // [1.4] היה בלי try/catch — כשל רשת השאיר את הכפתור נעול על
          // 'busy' לצמיתות, בלי הודעה ובלי דרך לנסות שוב
          setState('error');
        }
      }}
      className={`flex flex-wrap items-center gap-2 ${className}`}
    >
      <label htmlFor={`bis-${bookId}`} className="sr-only">
        {t('backInStockPrompt')}
      </label>
      <input
        id={`bis-${bookId}`}
        type="email"
        dir="ltr"
        required
        autoFocus
        placeholder={t('email')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="min-w-0 flex-1 rounded-[var(--radius-pill)] border border-rule bg-white/80 px-4 py-2.5 text-small text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
      />
      <button type="submit" disabled={state === 'busy'} className="btn btn-solid shrink-0">
        {t('backInStockCta')}
      </button>
      {state === 'error' ? (
        <p role="alert" className="w-full text-caption text-burgundy">
          {t('backInStockError')}
        </p>
      ) : null}
    </form>
  );
}
