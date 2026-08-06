'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslations } from 'next-intl';
import { useLocalMap, useLocalValue } from '@/lib/client-hooks';
import { getCartView, type CartViewModel } from '@/lib/commerce/cart-actions';
import { recordCommerceEvent } from '@/lib/commerce/events-actions';

/**
 * מצב העגלה (פרק 6 במסמך האב). העגלה עצמה מקומית — kr:cart ב-localStorage
 * (bookId → כמות), באותו מנגנון useLocalMap של המדף האישי: שרידה לרענון,
 * מסונכרנת בין לשוניות. השרת הוא שכבת האמת: כל שינוי נשלח לאימות
 * (getCartView) שמחזיר מחירים, זמינות, סכומים ותאריך — מהמסד, לא מהדפדפן.
 */

const CART_KEY = 'kr:cart';
const SESSION_KEY = 'kr:session';
const COUPON_KEY = 'kr:coupon';

export interface CartContextValue {
  enabled: boolean;
  count: number;
  items: { bookId: string; quantity: number }[];
  view: CartViewModel | null;
  loading: boolean;
  add: (bookId: string, title: string) => void;
  setQuantity: (bookId: string, quantity: number) => void;
  remove: (bookId: string) => void;
  clear: () => void;
  miniCartOpen: boolean;
  openMiniCart: () => void;
  closeMiniCart: () => void;
  sessionKey: string;
  /** [1.1] קוד הקופון שהוזן בעגלה — נשמר במכשיר ונודד ל-Checkout */
  couponCode: string | null;
  setCouponCode: (code: string) => void;
  clearCoupon: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue | null {
  return useContext(CartContext);
}

/** מפתח session אנונימי לאירועי אנליטיקה — נשמר מקומית, בלי PII. */
function ensureSessionKey(): string {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    return 'no-storage';
  }
}

export function CartProvider({
  children,
  enabled,
  locale,
}: {
  children: ReactNode;
  /** דגל cart_enabled המשורשר — מוזרם מהשרת, הרכיב אינו מכריע לבד */
  enabled: boolean;
  locale: string;
}) {
  const t = useTranslations('store');
  const { map, set, clear: clearEntry } = useLocalMap(CART_KEY);
  const { value: couponCode, set: setCouponValue, clear: clearCouponValue } = useLocalValue(COUPON_KEY);
  const [view, setView] = useState<CartViewModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [miniCartOpen, setMiniCartOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const requestId = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // אתחול עצל: רץ פעם אחת בצד הלקוח; אינו מרונדר, כך שאין פער הידרציה
  const [sessionKey] = useState(() =>
    typeof window === 'undefined' ? 'pending' : ensureSessionKey(),
  );

  const items = useMemo(
    () =>
      Object.entries(map)
        .map(([bookId, quantity]) => ({ bookId, quantity: Number(quantity) || 0 }))
        .filter((item) => item.quantity > 0),
    [map],
  );
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  // אימות שרת על כל שינוי, עם דחייה קצרה ופסילת תשובות ישנות.
  // עגלה ריקה אינה מאפסת state בתוך האפקט — ה-view האפקטיבי נגזר ברינדור.
  useEffect(() => {
    if (!enabled || items.length === 0) return;
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const previousPrices = Object.fromEntries(
          (view?.cart.lines ?? []).map((line) => [line.bookId, line.unitPrice]),
        );
        const next = await getCartView(items, locale, previousPrices, couponCode);
        if (requestId.current === id) setView(next);
      } catch {
        /* כשל רשת — הסכום הישן נשאר מוצג; הניסיון הבא יעדכן */
      } finally {
        if (requestId.current === id) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
    // view מכוון להיעדר: הוא משמש רק כמקור "המחיר שהוצג" להשוואה
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, items, locale, couponCode]);

  const effectiveView = items.length === 0 ? null : view;

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const add = useCallback(
    (bookId: string, title: string) => {
      const current = Number(map[bookId]) || 0;
      set(bookId, String(Math.min(current + 1, 99)));
      showToast(t('addedToCart', { title }));
      void recordCommerceEvent('product_added_to_cart', { sessionKey, bookId, locale });
    },
    [map, set, showToast, t, sessionKey, locale],
  );

  const removeItem = useCallback(
    (bookId: string) => {
      clearEntry(bookId);
      showToast(t('removedFromCart'));
    },
    [clearEntry, showToast, t],
  );

  const setQuantity = useCallback(
    (bookId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(bookId);
        return;
      }
      set(bookId, String(Math.min(Math.floor(quantity), 99)));
      void recordCommerceEvent('cart_updated', { sessionKey, bookId, locale });
    },
    [set, removeItem, sessionKey, locale],
  );

  const value: CartContextValue = {
    enabled,
    count,
    items,
    view: effectiveView,
    loading,
    add,
    setQuantity,
    remove: removeItem,
    clear: () => {
      for (const item of items) clearEntry(item.bookId);
      setView(null);
    },
    miniCartOpen,
    openMiniCart: () => {
      setMiniCartOpen(true);
      void recordCommerceEvent('cart_viewed', { sessionKey, locale });
    },
    closeMiniCart: () => setMiniCartOpen(false),
    sessionKey,
    couponCode,
    setCouponCode: (code: string) => {
      const normalized = code.trim().toUpperCase().slice(0, 40);
      if (normalized) {
        setCouponValue(normalized);
        void recordCommerceEvent('coupon_applied', { sessionKey, locale });
      }
    },
    clearCoupon: clearCouponValue,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
      {/* אזור חי להודעות העגלה — הכרזה לקורא מסך בלי להזיז מיקוד */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
        {toast ? (
          <span className="rounded-[var(--radius-pill)] bg-ink px-5 py-2.5 text-small text-cream shadow-[var(--shadow-float)]">
            {toast}
          </span>
        ) : null}
      </div>
    </CartContext.Provider>
  );
}
