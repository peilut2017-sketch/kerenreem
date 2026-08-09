'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createManualOrderAction } from '@/lib/admin/orders-actions';
import { AdminIcon } from '@/components/admin/AdminIcons';
import type { ShippingAddress } from '@/lib/supabase/types';

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
 * חיפוש ספר מהיר, והסכום מתעדכן תוך כדי. מחירים מהקטלוג בלבד; הסכום
 * המחייב מחושב בשרת (validateCart) — מה שמוצג כאן הוא אומדן חי.
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
  const [items, setItems] = useState<{ bookId: string; quantity: number }[]>([]);
  const [contact, setContact] = useState({ name: '', phone: '', email: '' });
  const [fulfillmentType, setFulfillmentType] = useState<'pickup' | 'shipping'>('pickup');
  const [methodId, setMethodId] = useState(methods[0]?.id ?? '');
  const [address, setAddress] = useState({ city: '', street: '', house_number: '' });
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const bookById = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return books
      .filter((b) => b.price != null && (b.title.includes(q) || (b.sku ?? '').includes(q)))
      .slice(0, 8);
  }, [books, query]);

  const subtotal = items.reduce(
    (sum, item) => sum + (bookById.get(item.bookId)?.price ?? 0) * item.quantity,
    0,
  );
  const shippingEstimate =
    fulfillmentType === 'pickup' ? 0 : (methods.find((m) => m.id === methodId)?.price ?? 0);

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
        items,
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
              },
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
                        {book.originalPrice != null ? (
                          <span className="me-1 line-through">{book.originalPrice.toFixed(2)} ₪</span>
                        ) : null}
                        {book.price?.toFixed(2)} ₪
                        {book.available != null ? ` · במלאי ${book.available}` : ''}
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
                  <li key={item.bookId} className="flex items-center gap-3 py-2.5 text-small">
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
                    <span className="w-28 text-end tabular-nums text-ink">
                      {book.originalPrice != null ? (
                        <span className="block text-caption leading-tight text-muted line-through">
                          {(book.originalPrice * item.quantity).toFixed(2)} ₪
                        </span>
                      ) : null}
                      {((book.price ?? 0) * item.quantity).toFixed(2)} ₪
                    </span>
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
        <h2 className="mb-3 text-small font-bold text-ink">סיכום (אומדן — הסכום המחייב מהשרת)</h2>
        <dl className="space-y-2 text-small text-ink-soft">
          <div className="flex justify-between">
            <dt>פריטים ({items.reduce((s, i) => s + i.quantity, 0)})</dt>
            <dd className="tabular-nums text-ink">{subtotal.toFixed(2)} ₪</dd>
          </div>
          <div className="flex justify-between">
            <dt>משלוח</dt>
            <dd className="tabular-nums text-ink">
              {fulfillmentType === 'pickup' ? 'איסוף — ללא' : `${shippingEstimate.toFixed(2)} ₪`}
            </dd>
          </div>
          <div className="flex justify-between border-t border-[var(--admin-border)] pt-2 font-semibold text-ink">
            <dt>סה״כ משוער</dt>
            <dd className="tabular-nums">{(subtotal + shippingEstimate).toFixed(2)} ₪</dd>
          </div>
        </dl>
        {error ? (
          <p role="alert" className="mt-3 rounded-[8px] bg-[var(--admin-danger-soft)] px-3 py-2 text-caption text-[var(--admin-danger)]">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={pending || items.length === 0 || !contact.name.trim() || !contact.phone.trim()}
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
