'use client';

import { useState, useTransition } from 'react';
import { deletePromotion, savePromotion } from '@/lib/admin/coupons-actions';
import { AdminIcon } from '@/components/admin/AdminIcons';
import type { Promotion } from '@/lib/supabase/types';

export interface PromotionOption {
  id: string;
  label: string;
}

/**
 * [1.3] מבצעים אוטומטיים: הנחת אחוז/סכום על כל האתר, קטגוריות או ספרים
 * (עם החרגות), בתנאי מינימום יחידות/סכום — חלים מעצמם בעגלה בלי קוד.
 * מבצע אחד מוחל להזמנה (הטוב ביותר); צבירה עם קופון רק אם סומנה.
 */
export function PromotionsManager({
  promotions,
  categories,
  books,
}: {
  promotions: Promotion[];
  categories: PromotionOption[];
  books: PromotionOption[];
}) {
  const empty = {
    id: null as string | null,
    name: '',
    kind: 'percent' as 'percent' | 'fixed',
    value: '',
    scopeAll: true,
    categoryIds: [] as string[],
    bookIds: [] as string[],
    excludeBookIds: [] as string[],
    minTotal: '',
    minQuantity: '',
    combinableWithCoupon: false,
    endsAt: '',
    active: true,
  };
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function edit(promo: Promotion) {
    setForm({
      id: promo.id,
      name: promo.name,
      kind: promo.kind,
      value: String(promo.value),
      scopeAll: Boolean(promo.scope?.all),
      categoryIds: promo.scope?.category_ids ?? [],
      bookIds: promo.scope?.book_ids ?? [],
      excludeBookIds: promo.scope?.exclude_book_ids ?? [],
      minTotal: promo.min_total != null ? String(promo.min_total) : '',
      minQuantity: promo.min_quantity != null ? String(promo.min_quantity) : '',
      combinableWithCoupon: promo.combinable_with_coupon,
      endsAt: promo.ends_at ? promo.ends_at.slice(0, 10) : '',
      active: promo.active,
    });
    setOpen(true);
    setMessage(null);
  }

  function submit() {
    startTransition(async () => {
      const result = await savePromotion(form.id, {
        name: form.name,
        kind: form.kind,
        value: Number(form.value),
        scopeAll: form.scopeAll,
        categoryIds: form.scopeAll ? [] : form.categoryIds,
        bookIds: form.scopeAll ? [] : form.bookIds,
        excludeBookIds: form.excludeBookIds,
        minTotal: form.minTotal.trim() === '' ? null : Number(form.minTotal),
        minQuantity: form.minQuantity.trim() === '' ? null : Number(form.minQuantity),
        combinableWithCoupon: form.combinableWithCoupon,
        startsAt: null,
        endsAt: form.endsAt ? new Date(`${form.endsAt}T23:59:59`).toISOString() : null,
        active: form.active,
      });
      setMessage(result.ok ? 'נשמר.' : (result.error ?? 'השמירה נכשלה'));
      if (result.ok) {
        setForm(empty);
        setOpen(false);
      }
    });
  }

  const multiSelect = (
    label: string,
    options: PromotionOption[],
    selected: string[],
    onChange: (next: string[]) => void,
  ) => (
    <div>
      <span className="admin-field-label">{label}</span>
      <select
        multiple
        size={Math.min(5, Math.max(3, options.length))}
        value={selected}
        onChange={(e) => onChange([...e.target.selectedOptions].map((o) => o.value))}
        className="admin-field-input h-auto"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <section className="mt-10" aria-labelledby="promotions-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="promotions-heading" className="flex items-center gap-2 font-serif text-h3 text-ink">
          <span className="admin-icon-chip h-9 w-9">
            <AdminIcon name="coupon" className="h-4.5 w-4.5" />
          </span>
          מבצעים אוטומטיים
        </h2>
        <button
          type="button"
          onClick={() => {
            setForm(empty);
            setOpen(true);
            setMessage(null);
          }}
          className="admin-btn admin-btn-solid"
        >
          <AdminIcon name="plus" className="h-4 w-4" />
          מבצע חדש
        </button>
      </div>

      {message ? (
        <p role="status" className="mb-3 text-caption text-ink-soft">{message}</p>
      ) : null}

      {open ? (
        <div className="admin-card mb-5 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <label htmlFor="promo-name" className="admin-field-label">שם המבצע (מוצג ללקוח)</label>
              <input id="promo-name" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} placeholder='למשל "מבצע בין הזמנים — 10% על כל האתר"' className="admin-field-input" />
            </div>
            <div>
              <label htmlFor="promo-kind" className="admin-field-label">סוג ההנחה</label>
              <div className="flex gap-2">
                <select id="promo-kind" value={form.kind} onChange={(e) => setForm((v) => ({ ...v, kind: e.target.value as 'percent' | 'fixed' }))} className="admin-field-input w-32">
                  <option value="percent">אחוז</option>
                  <option value="fixed">סכום ₪</option>
                </select>
                <input aria-label="ערך ההנחה" type="number" dir="ltr" min={0} value={form.value} onChange={(e) => setForm((v) => ({ ...v, value: e.target.value }))} className="admin-field-input" />
              </div>
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="flex items-center gap-2 text-small text-ink">
                <input type="checkbox" checked={form.scopeAll} onChange={(e) => setForm((v) => ({ ...v, scopeAll: e.target.checked }))} className="h-4 w-4" />
                חל על כל האתר
              </label>
            </div>
            {!form.scopeAll ? (
              <>
                {multiSelect('קטגוריות', categories, form.categoryIds, (next) => setForm((v) => ({ ...v, categoryIds: next })))}
                {multiSelect('ספרים', books, form.bookIds, (next) => setForm((v) => ({ ...v, bookIds: next })))}
              </>
            ) : null}
            {multiSelect('החרגת ספרים', books, form.excludeBookIds, (next) => setForm((v) => ({ ...v, excludeBookIds: next })))}

            <div>
              <label htmlFor="promo-min-total" className="admin-field-label">מינימום ₪ למימוש</label>
              <input id="promo-min-total" type="number" dir="ltr" min={0} value={form.minTotal} onChange={(e) => setForm((v) => ({ ...v, minTotal: e.target.value }))} placeholder="ללא" className="admin-field-input" />
            </div>
            <div>
              <label htmlFor="promo-min-qty" className="admin-field-label">מינימום יחידות</label>
              <input id="promo-min-qty" type="number" dir="ltr" min={1} value={form.minQuantity} onChange={(e) => setForm((v) => ({ ...v, minQuantity: e.target.value }))} placeholder="ללא" className="admin-field-input" />
            </div>
            <div>
              <label htmlFor="promo-ends" className="admin-field-label">בתוקף עד</label>
              <input id="promo-ends" type="date" dir="ltr" value={form.endsAt} onChange={(e) => setForm((v) => ({ ...v, endsAt: e.target.value }))} className="admin-field-input" />
            </div>
            <label className="flex items-center gap-2 text-small text-ink-soft sm:col-span-2">
              <input type="checkbox" checked={form.combinableWithCoupon} onChange={(e) => setForm((v) => ({ ...v, combinableWithCoupon: e.target.checked }))} className="h-4 w-4" />
              ניתן לצירוף עם קופון (ברירת מחדל: לא — המבצע מפנה את מקומו לקופון)
            </label>
            <label className="flex items-center gap-2 text-small text-ink-soft">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((v) => ({ ...v, active: e.target.checked }))} className="h-4 w-4" />
              פעיל
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" disabled={pending || !form.name.trim() || !form.value} onClick={submit} className="admin-btn admin-btn-solid">
              {form.id ? 'שמירת השינויים' : 'יצירת המבצע'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="admin-btn admin-btn-ghost">
              ביטול
            </button>
          </div>
        </div>
      ) : null}

      <div className="admin-card admin-table-wrap">
        <table className="admin-table w-full min-w-[40rem] text-small">
          <thead>
            <tr>
              <th className="px-4 py-3 text-start">מבצע</th>
              <th className="px-4 py-3 text-start">הנחה</th>
              <th className="px-4 py-3 text-start">תחולה</th>
              <th className="px-4 py-3 text-start">תנאים</th>
              <th className="px-4 py-3 text-start">תוקף</th>
              <th className="px-4 py-3 text-start">מצב</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {promotions.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">אין מבצעים. מבצע חל אוטומטית — בלי קוד קופון.</td></tr>
            ) : (
              promotions.map((promo) => (
                <tr key={promo.id}>
                  <td className="px-4 py-2.5 font-medium text-ink">{promo.name}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {promo.kind === 'percent' ? `${promo.value}%` : `${promo.value} ₪`}
                  </td>
                  <td className="px-4 py-2.5 text-muted">
                    {promo.scope?.all
                      ? 'כל האתר'
                      : [
                          promo.scope?.category_ids?.length ? `${promo.scope.category_ids.length} קטגוריות` : null,
                          promo.scope?.book_ids?.length ? `${promo.scope.book_ids.length} ספרים` : null,
                        ].filter(Boolean).join(' + ') || '—'}
                    {promo.scope?.exclude_book_ids?.length ? ` (בלי ${promo.scope.exclude_book_ids.length})` : ''}
                  </td>
                  <td className="px-4 py-2.5 text-muted">
                    {[
                      promo.min_total != null ? `מ-${promo.min_total} ₪` : null,
                      promo.min_quantity != null ? `מ-${promo.min_quantity} יח׳` : null,
                    ].filter(Boolean).join(' · ') || 'ללא'}
                  </td>
                  <td className="px-4 py-2.5 text-muted">
                    {promo.ends_at ? new Intl.DateTimeFormat('he-IL', { dateStyle: 'short' }).format(new Date(promo.ends_at)) : 'ללא הגבלה'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`admin-badge ${promo.active ? 'admin-badge-success' : 'admin-badge-neutral'}`}>
                      {promo.active ? 'פעיל' : 'כבוי'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-end">
                    <span className="inline-flex gap-1">
                      <button type="button" onClick={() => edit(promo)} className="admin-btn admin-btn-ghost admin-btn-icon" aria-label={`עריכה — ${promo.name}`}>
                        <AdminIcon name="edit" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(`למחוק את המבצע "${promo.name}"?`)) return;
                          startTransition(async () => {
                            const result = await deletePromotion(promo.id);
                            setMessage(result.ok ? 'נמחק.' : (result.error ?? 'המחיקה נכשלה'));
                          });
                        }}
                        className="admin-btn admin-btn-ghost admin-btn-icon"
                        aria-label={`מחיקה — ${promo.name}`}
                      >
                        <AdminIcon name="trash" className="h-4 w-4" />
                      </button>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
