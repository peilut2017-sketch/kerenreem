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
/** [1.6] "המחיר האחרון שהוצג" — נשמר מקומית כדי לזהות שינוי מחיר גם בין ביקורים (ח.4), לא רק בתוך אותו session */
const PRICE_KEY = 'kr:cart-prices';

export interface CartContextValue {
  enabled: boolean;
  count: number;
  items: { bookId: string; quantity: number }[];
  view: CartViewModel | null;
  loading: boolean;
  /**
   * אימות השרת האחרון נכשל (רשת) — הסכומים המוצגים עלולים להיות ישנים.
   * המסכים מציגים אזהרה וחוסמים מעבר לתשלום עד רענון מוצלח; בלי הדגל
   * הזה שינוי כמות שנכשל השאיר את הסכום הישן על המסך בלי שום סימן.
   */
  stale: boolean;
  /** ניסיון אימות חוזר יזום — לכפתור "רענון" באזהרת ה-stale */
  refresh: () => void;
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
  const { map: lastSeenPrices, set: setLastSeenPrice } = useLocalMap(PRICE_KEY);
  const { value: couponCode, set: setCouponValue, clear: clearCouponValue } = useLocalValue(COUPON_KEY);
  const [view, setView] = useState<CartViewModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [stale, setStale] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [miniCartOpen, setMiniCartOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    action?: { label: string; onClick: () => void };
  } | null>(null);
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
        // [1.6] "המחיר שהוצג" נקרא מ-localStorage (PRICE_KEY), לא מ-view
        // בזיכרון: view מתאפס בכל רענון עמוד, כך ששינוי שקרה בין ביקורים
        // (ח.4) היה נבלע בשקט בטעינה הראשונה. localStorage שורד רענון.
        const previousPrices: Record<string, number> = {};
        for (const item of items) {
          const raw = lastSeenPrices[item.bookId];
          if (raw != null) previousPrices[item.bookId] = Number(raw);
        }
        const next = await getCartView(items, locale, previousPrices, couponCode);
        if (requestId.current === id) {
          setView(next);
          setStale(false);
          for (const line of next.cart.lines) {
            if (line.removedReason === null) setLastSeenPrice(line.bookId, String(line.unitPrice));
          }
        }
      } catch {
        // כשל רשת: הסכום הישן נשאר מוצג, אבל לא בשקט — הדגל stale מדליק
        // אזהרה במסכים וחוסם מעבר לתשלום. "הניסיון הבא" אינו אוטומטי
        // (האפקט רץ רק על שינוי), ולכן refresh() נותן דרך יזומה לנסות שוב.
        if (requestId.current === id) setStale(true);
      } finally {
        if (requestId.current === id) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
    // lastSeenPrices/setLastSeenPrice מכוונים להיעדר: אותו עיקרון כמו view
    // קודם לכן — משמשים רק כמקור השוואה, קריאה טרייה בכל הרצה בפועל
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, items, locale, couponCode, retryTick]);

  const effectiveView = items.length === 0 ? null : view;

  const showToast = useCallback(
    (message: string, action?: { label: string; onClick: () => void }) => {
      setToast({ message, action });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      // עם פעולת ביטול — חלון ארוך יותר: 2.6 שניות אינן מספיקות להבין
      // שהוסר משהו, לקרוא ולהחליט ללחוץ "ביטול".
      toastTimer.current = setTimeout(() => setToast(null), action ? 6000 : 2600);
    },
    [],
  );

  const add = useCallback(
    (bookId: string, title: string) => {
      const current = Number(map[bookId]) || 0;
      set(bookId, String(Math.min(current + 1, 99)));
      showToast(t('addedToCart', { title }));
      // [1.6] פתיחת המיני-סל בהוספה (ח.2) — לצד ה-toast, לא במקומו: ה-toast
      // מכריז לקורא מסך מה נוסף בבירור; פתיחת המגירה נותנת גם מבט מיידי
      // על העגלה כולה בלי קליק נוסף.
      setMiniCartOpen(true);
      void recordCommerceEvent('product_added_to_cart', { sessionKey, bookId, locale }).catch(() => {});
    },
    [map, set, showToast, t, sessionKey, locale],
  );

  const removeItem = useCallback(
    (bookId: string) => {
      // צילום הכמות לפני המחיקה — "ביטול" מחזיר את השורה בדיוק כפי שהייתה.
      // הסרה בטעות בלי דרך חזרה היא אובדן; ביטול של 6 שניות הוא הסטנדרט.
      const previousQuantity = Number(map[bookId]) || 0;
      clearEntry(bookId);
      showToast(
        t('removedFromCart'),
        previousQuantity > 0
          ? {
              label: t('undo'),
              onClick: () => {
                set(bookId, String(previousQuantity));
                setToast(null);
              },
            }
          : undefined,
      );
    },
    [map, set, clearEntry, showToast, t],
  );

  const setQuantity = useCallback(
    (bookId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(bookId);
        return;
      }
      set(bookId, String(Math.min(Math.floor(quantity), 99)));
      void recordCommerceEvent('cart_updated', { sessionKey, bookId, locale }).catch(() => {});
    },
    [set, removeItem, sessionKey, locale],
  );

  const value: CartContextValue = {
    enabled,
    count,
    items,
    view: effectiveView,
    loading,
    stale,
    refresh: () => setRetryTick((n) => n + 1),
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
      void recordCommerceEvent('cart_viewed', { sessionKey, locale }).catch(() => {});
    },
    closeMiniCart: () => setMiniCartOpen(false),
    sessionKey,
    couponCode,
    setCouponCode: (code: string) => {
      const normalized = code.trim().toUpperCase().slice(0, 40);
      if (normalized) {
        setCouponValue(normalized);
        void recordCommerceEvent('coupon_applied', { sessionKey, locale }).catch(() => {});
      }
    },
    clearCoupon: clearCouponValue,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
      {/* אזור חי להודעות העגלה — הכרזה לקורא מסך בלי להזיז מיקוד.
          pointer-events-auto על הבועה עצמה בלבד: כפתור "ביטול" חייב להיות
          לחיץ, אבל שאר הרצועה נשארת שקופה לקליקים. */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(1.5rem+var(--consent-h,0px))] z-[60] flex justify-center px-4">
        {toast ? (
          <span className="pointer-events-auto flex items-center gap-3 rounded-[var(--radius-pill)] bg-ink px-5 py-2.5 text-small text-cream shadow-[var(--shadow-float)]">
            {toast.message}
            {toast.action ? (
              <button
                type="button"
                onClick={toast.action.onClick}
                className="font-semibold text-gold-bright underline underline-offset-2 hover:text-gold"
              >
                {toast.action.label}
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
    </CartContext.Provider>
  );
}
