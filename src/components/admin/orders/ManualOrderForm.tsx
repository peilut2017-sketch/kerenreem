'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createManualOrderAction, previewManualOrderTotalsAction } from '@/lib/admin/orders-actions';
import { AdminIcon } from '@/components/admin/AdminIcons';
import type { ShippingAddress } from '@/lib/supabase/types';

const COUPON_ERROR_TEXT: Record<string, string> = {
  invalid: 'הקוד אינו מוכר או שאינו בתוקף',
  used_up: 'הקופון מוצה',
  not_applicable: 'הקופון אינו חל על הפריטים שבסל',
  not_combinable: 'לא ניתן לצרף את הקופון לקופון שכבר הוחל — קופון אחד להזמנה',
  min_total: 'הקופון תקף מסכום גבוה יותר',
};

interface Preview {
  loading: boolean;
  /** true אחרי שהשרת ענה לפחות פעם אחת — עד אז אין להציג "0.00 ₪" מטעה */
  ready: boolean;
  subtotal: number;
  shippingTotal: number;
  discountTotal: number;
  total: number;
  freeShippingApplied: boolean;
  couponValid: boolean;
  couponError: string | null;
  promotionName: string | null;
  serverError: string | null;
}

const IDLE_PREVIEW: Preview = {
  loading: false,
  ready: false,
  subtotal: 0,
  shippingTotal: 0,
  discountTotal: 0,
  total: 0,
  freeShippingApplied: false,
  couponValid: false,
  couponError: null,
  promotionName: null,
  serverError: null,
};

export interface ManualOrderBook {
  id: string;
  title: string;
  sku: string | null;
  /** [1.4] המחיר בתוקף עכשיו — מחיר מבצע כשיש (getEffectivePrice), לא price הגולמי */
  price: number | null;
  /** המחיר הרגיל, רק כשהספר במבצע — לצוות, כדי להקריא ללקוח "יש לך מבצע" ולא לזייף */
  originalPrice: number | null;
  saleName: string | null;
  available: number | null;
}

export interface ManualShippingMethod {
  id: string;
  name: string;
  price: number;
}

/**
 * טופס ההזמנה הטלפונית (פרק 9.6): איש הצוות בשיחה — לכן הכל במסך אחד,
 * חיפוש ספר מהיר, והסכום מתעדכן תוך כדי. מחירים מהקטלוג; [1.9] חריג
 * יחיד — ספר בלי מחיר קטלוגי, שם הצוות מתמחר את הפריט בטופס עצמו
 * (manualPrice למטה). הסכום המחייב מחושב בשרת (validateCart) — מה
 * שמוצג כאן הוא אומדן חי.
 */
export function ManualOrderForm({
  books,
  methods,
}: {
  books: ManualOrderBook[];
  methods: ManualShippingMethod[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<{ bookId: string; quantity: number; manualPrice?: number }[]>(
    [],
  );
  const [contact, setContact] = useState({ name: '', phone: '', email: '' });
  const [fulfillmentType, setFulfillmentType] = useState<'pickup' | 'shipping'>('pickup');
  const [methodId, setMethodId] = useState(methods[0]?.id ?? '');
  const [address, setAddress] = useState({ city: '', street: '', house_number: '' });
  const [courierNotes, setCourierNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const bookById = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  // [1.9] לא מסננים לפי price != null: ספר קטלוגי (is_purchasable) בלי
  // מחיר מוגדר עדיין ניתן להוספה — הצוות מתמחר אותו בשורת הפריט (למטה).
  // היעלמות שקטה מהתוצאות הייתה נראית לצוות כאילו הספר לא קיים בקטלוג
  // בכלל, בלי שום דרך להזמין אותו טלפונית.
  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return books.filter((b) => b.title.includes(q) || (b.sku ?? '').includes(q)).slice(0, 8);
  }, [books, query]);

  // פריט שספרו בלי מחיר קטלוגי וטרם הוקלד לו מחיר — לא ניתן לשלוח כך.
  const hasMissingManualPrice = items.some(
    (item) => bookById.get(item.bookId)?.price == null && !(item.manualPrice != null && item.manualPrice > 0),
  );

  // [1.5] "משלוח חינם לא מחושב, אי אפשר להזין קופון" — אומדן חי מהשרת
  // (previewManualOrderTotalsAction, אותו resolvePricing כמו ביצירה
  // בפועל) במקום חשבון קליינט-בלבד שהתעלם מסף המשלוח החינם ומקופון.
  const [preview, setPreview] = useState<Preview>(IDLE_PREVIEW);
  const requestId = useRef(0);

  useEffect(() => {
    if (items.length === 0 || hasMissingManualPrice) return;
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      setPreview((p) => ({ ...p, loading: true }));
      previewManualOrderTotalsAction({
        items: items.map((item) => ({ ...item, manualUnitPrice: item.manualPrice })),
        fulfillment:
          fulfillmentType === 'pickup' ? { type: 'pickup' } : { type: 'shipping', methodId },
        couponCode: couponCode.trim() || null,
        contactPhone: contact.phone.trim() || null,
        contactEmail: contact.email.trim() || null,
      }).then((result) => {
        if (requestId.current !== id) return;
        setPreview({
          loading: false,
          ready: true,
          subtotal: result.subtotal,
          shippingTotal: result.shippingTotal,
          discountTotal: result.discountTotal,
          total: result.total,
          freeShippingApplied: result.freeShippingApplied,
          couponValid: result.couponValid,
          couponError: result.couponError,
          promotionName: result.promotionName,
          serverError: result.ok ? null : (result.error ?? 'חישוב הסכום נכשל'),
        });
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [items, hasMissingManualPrice, fulfillmentType, methodId, couponCode, contact.phone, contact.email]);

  const showPreview = items.length > 0;
  // תצוגה מיידית לשורת הפריטים (מהקטלוג בצד הלקוח, כבר כולל מבצע) — לא
  // ממתינה לעגול-התור מהשרת; משלוח/הנחה/סה״כ תמיד מהשרת בלבד (preview.ready).
  // [1.9] לספר בלי מחיר קטלוגי — המחיר שהצוות הקליד (manualPrice).
  const clientSubtotal = items.reduce(
    (sum, item) => sum + (bookById.get(item.bookId)?.price ?? item.manualPrice ?? 0) * item.quantity,
    0,
  );

  function addItem(bookId: string) {
    setItems((current) => {
      const existing = current.find((item) => item.bookId === bookId);
      if (existing) {
        return current.map((item) =>
          item.bookId === bookId ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...current, { bookId, quantity: 1 }];
    });
    setQuery('');
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createManualOrderAction({
        items: items.map((item) => ({ ...item, manualUnitPrice: item.manualPrice })),
        contact: {
          name: contact.name,
          phone: contact.phone,
          email: contact.email.trim() || null,
        },
        fulfillment:
          fulfillmentType === 'pickup'
            ? { type: 'pickup' }
            : {
                type: 'shipping',
                methodId,
                address: {
                  recipient_name: contact.name,
                  phone: contact.phone,
                  city: address.city,
                  street: address.street,
                  house_number: address.house_number,
                } as ShippingAddress,
                courierNotes: courierNotes.trim() || undefined,
              },
        couponCode: preview.couponValid ? couponCode.trim() || null : null,
        note: note.trim() || null,
      });
      if (!result.ok || !result.orderId) {
        setError(result.error ?? 'יצירת ההזמנה נכשלה');
        return;
      }
      router.push(`/admin/orders/${result.orderId}`);
    });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        {/* פריטים */}
        <section className="admin-card px-5 py-4">
          <h2 className="mb-3 text-small font-bold text-ink">פריטי ההזמנה</h2>
          <div className="relative">
            <AdminIcon
              name="search"
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש ספר בשם או במק״ט…"
              className="admin-field-input ps-9"
            />
            {results.length > 0 ? (
              <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-[10px] border border-[var(--admin-border)] bg-white shadow-[var(--admin-shadow-hover)]">
                {results.map((book) => (
                  <li key={book.id}>
                    <button
                      type="button"
                      onClick={() => addItem(book.id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start text-small hover:bg-[var(--admin-accent-soft)]"
                    >
                      <span className="min-w-0 truncate text-ink">
                        {book.title}
                        {book.originalPrice != null ? (
                          <span className="ms-1.5 rounded-[var(--radius-pill)] bg-[var(--admin-warning-soft)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--admin-warning)]">
                            מבצע
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-caption text-muted tabular-nums">
                        {book.price == null ? (
                          <span className="text-[var(--admin-danger)]">אין מחיר מוגדר</span>
                        ) : (
                          <>
                            {book.originalPrice != null ? (
                              <span className="me-1 line-through">{book.originalPrice.toFixed(2)} ₪</span>
                            ) : null}
                            {book.price.toFixed(2)} ₪
                            {book.available != null ? ` · במלאי ${book.available}` : ''}
                          </>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {items.length === 0 ? (
            <p className="mt-4 text-small text-muted">חפשו ספר והוסיפו אותו להזמנה.</p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--admin-border)]">
              {items.map((item) => {
                const book = bookById.get(item.bookId);
                if (!book) return null;
                return (
                  <li key={item.bookId} className="space-y-2 py-2.5 text-small">
                    <div className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-ink">
                        {book.title}
                        {book.originalPrice != null ? (
                          <span className="ms-1.5 rounded-[var(--radius-pill)] bg-[var(--admin-warning-soft)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--admin-warning)]">
                            מבצע
                          </span>
                        ) : null}
                      </span>
                      <input
                        type="number"
                        dir="ltr"
                        min={1}
                        max={99}
                        value={item.quantity}
                        aria-label={`כמות — ${book.title}`}
                        onChange={(e) =>
                          setItems((current) =>
                            current.map((it) =>
                              it.bookId === item.bookId
                                ? { ...it, quantity: Math.max(1, Number(e.target.value) || 1) }
                                : it,
                            ),
                          )
                        }
                        className="admin-field-input w-20 py-1.5 text-center"
                      />
                      {book.price != null ? (
                        <span className="w-28 text-end tabular-nums text-ink">
                          {book.originalPrice != null ? (
                            <span className="block text-caption leading-tight text-muted line-through">
                              {(book.originalPrice * item.quantity).toFixed(2)} ₪
                            </span>
                          ) : null}
                          {(book.price * item.quantity).toFixed(2)} ₪
                        </span>
                      ) : null}
                      <button
                        type="button"
                        aria-label={`הסרה — ${book.title}`}
                        onClick={() =>
                          setItems((current) => current.filter((it) => it.bookId !== item.bookId))
                        }
                        className="text-muted hover:text-[var(--admin-danger)]"
                      >
                        <AdminIcon name="trash" className="h-4 w-4" />
                      </button>
                    </div>
                    {book.price == null ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] bg-[var(--admin-danger-soft)] px-3 py-2">
                        <label
                          htmlFor={`mo-manual-price-${item.bookId}`}
                          className="text-caption text-[var(--admin-danger)]"
                        >
                          אין מחיר קטלוגי לספר הזה — הזינו מחיר ליחידה כדי להמשיך
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            id={`mo-manual-price-${item.bookId}`}
                            type="number"
                            dir="ltr"
                            min={0}
                            step={0.5}
                            value={item.manualPrice ?? ''}
                            placeholder="0.00"
                            onChange={(e) =>
                              setItems((current) =>
                                current.map((it) =>
                                  it.bookId === item.bookId
                                    ? {
                                        ...it,
                                        manualPrice:
                                          e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0),
                                      }
                                    : it,
                                ),
                              )
                            }
                            className="admin-field-input w-24 py-1.5 text-end"
                          />
                          <span className="text-caption text-muted">₪ ליחידה</span>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* לקוח */}
        <section className="admin-card px-5 py-4">
          <h2 className="mb-3 text-small font-bold text-ink">פרטי הלקוח</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="mo-name" className="admin-field-label">שם מלא</label>
              <input id="mo-name" value={contact.name} onChange={(e) => setContact((v) => ({ ...v, name: e.target.value }))} className="admin-field-input" />
            </div>
            <div>
              <label htmlFor="mo-phone" className="admin-field-label">טלפון</label>
              <input id="mo-phone" dir="ltr" value={contact.phone} onChange={(e) => setContact((v) => ({ ...v, phone: e.target.value }))} className="admin-field-input" />
            </div>
            <div>
              <label htmlFor="mo-email" className="admin-field-label">מייל (לקישור תשלום ואישורים)</label>
              <input id="mo-email" dir="ltr" type="email" value={contact.email} onChange={(e) => setContact((v) => ({ ...v, email: e.target.value }))} className="admin-field-input" />
            </div>
          </div>
          <p className="mt-2 text-caption text-muted">
            בלי מייל אפשר להמשיך — הגבייה תסתיים בסימון תשלום חיצוני, והמסמך יצורף מודפס לחבילה.
          </p>
        </section>

        {/* אספקה */}
        <section className="admin-card px-5 py-4">
          <h2 className="mb-3 text-small font-bold text-ink">אספקה</h2>
          <div className="flex gap-2">
            {(
              [
                ['pickup', 'איסוף עצמי'],
                ['shipping', 'משלוח'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={fulfillmentType === value}
                onClick={() => setFulfillmentType(value)}
                className={`admin-btn ${fulfillmentType === value ? 'admin-btn-solid' : 'admin-btn-quiet'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {fulfillmentType === 'shipping' ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="mo-method" className="admin-field-label">שיטת משלוח</label>
                <select id="mo-method" value={methodId} onChange={(e) => setMethodId(e.target.value)} className="admin-field-input">
                  {methods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name} — {method.price.toFixed(2)} ₪
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="mo-city" className="admin-field-label">עיר</label>
                <input id="mo-city" value={address.city} onChange={(e) => setAddress((v) => ({ ...v, city: e.target.value }))} className="admin-field-input" />
              </div>
              <div>
                <label htmlFor="mo-street" className="admin-field-label">רחוב ומספר</label>
                <div className="flex gap-2">
                  <input id="mo-street" value={address.street} onChange={(e) => setAddress((v) => ({ ...v, street: e.target.value }))} className="admin-field-input" />
                  <input aria-label="מספר בית" dir="ltr" value={address.house_number} onChange={(e) => setAddress((v) => ({ ...v, house_number: e.target.value }))} className="admin-field-input w-20" />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="mo-courier-notes" className="admin-field-label">הערה לשליח (תודפס גם על מדבקת המשלוח)</label>
                <input
                  id="mo-courier-notes"
                  value={courierNotes}
                  onChange={(e) => setCourierNotes(e.target.value)}
                  placeholder="למשל: קוד כניסה, קומה בלי מעלית, להשאיר אצל השכן…"
                  className="admin-field-input"
                />
              </div>
            </div>
          ) : null}
          <div className="mt-4">
            <label htmlFor="mo-note" className="admin-field-label">הערה פנימית (ציר הזמן)</label>
            <input id="mo-note" value={note} onChange={(e) => setNote(e.target.value)} className="admin-field-input" />
          </div>
        </section>
      </div>

      {/* סיכום */}
      <aside className="admin-card px-5 py-4 xl:sticky xl:top-6">
        <h2 className="mb-3 text-small font-bold text-ink">סיכום (הסכום מחושב בשרת — לא הקלדה)</h2>

        <div className="mb-3">
          <label htmlFor="mo-coupon" className="admin-field-label">קוד קופון</label>
          <input
            id="mo-coupon"
            dir="ltr"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder="אופציונלי"
            className="admin-field-input text-end"
            style={{ textTransform: 'uppercase' }}
          />
          {couponCode.trim() && !preview.loading ? (
            preview.couponValid ? (
              <p className="mt-1 text-caption text-[var(--admin-success)]">✓ הקופון תקף ומוחל בסכום למטה</p>
            ) : preview.couponError ? (
              <p className="mt-1 text-caption text-[var(--admin-danger)]">
                {COUPON_ERROR_TEXT[preview.couponError] ?? 'הקופון אינו תקף'}
              </p>
            ) : null
          ) : null}
        </div>

        <dl className="space-y-2 text-small text-ink-soft">
          <div className="flex justify-between">
            <dt>פריטים ({items.reduce((s, i) => s + i.quantity, 0)})</dt>
            <dd className="tabular-nums text-ink">{clientSubtotal.toFixed(2)} ₪</dd>
          </div>
          {preview.ready && preview.discountTotal > 0 ? (
            <div className="flex justify-between text-[var(--admin-success)]">
              <dt>הנחה{preview.promotionName ? ` — ${preview.promotionName}` : ''}</dt>
              <dd className="tabular-nums">−{preview.discountTotal.toFixed(2)} ₪</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt>משלוח</dt>
            <dd className="tabular-nums text-ink">
              {fulfillmentType === 'pickup' ? (
                'איסוף — ללא'
              ) : !preview.ready ? (
                <span className="text-muted">מחשב…</span>
              ) : preview.shippingTotal === 0 ? (
                <span className="text-[var(--admin-success)]">חינם{preview.freeShippingApplied ? ' (מעל סף)' : ''}</span>
              ) : (
                `${preview.shippingTotal.toFixed(2)} ₪`
              )}
            </dd>
          </div>
          <div className="flex justify-between border-t border-[var(--admin-border)] pt-2 font-semibold text-ink">
            <dt>סה״כ לגבייה{preview.loading ? ' (מעדכן…)' : ''}</dt>
            <dd className="tabular-nums">
              {!showPreview || preview.ready ? `${preview.total.toFixed(2)} ₪` : 'מחשב…'}
            </dd>
          </div>
        </dl>
        {preview.serverError ? (
          <p role="alert" className="mt-3 rounded-[8px] bg-[var(--admin-danger-soft)] px-3 py-2 text-caption text-[var(--admin-danger)]">
            {preview.serverError}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 rounded-[8px] bg-[var(--admin-danger-soft)] px-3 py-2 text-caption text-[var(--admin-danger)]">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={
            pending ||
            items.length === 0 ||
            hasMissingManualPrice ||
            !contact.name.trim() ||
            !contact.phone.trim() ||
            preview.loading ||
            !preview.ready
          }
          onClick={submit}
          className="admin-btn admin-btn-solid mt-4 w-full"
        >
          {pending ? 'יוצר הזמנה…' : 'יצירת ההזמנה'}
        </button>
        <p className="mt-3 text-caption text-muted">
          אחרי היצירה: שליחת קישור תשלום במייל מעמוד ההזמנה, או סימון תשלום חיצוני
          (מזומן/העברה). המלאי נשמר כבר עכשיו.
        </p>
      </aside>
    </div>
  );
}
