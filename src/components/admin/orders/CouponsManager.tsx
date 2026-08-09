'use client';

import { useActionState, useState, useTransition } from 'react';
import { createCoupon, deleteCoupon, setCouponActive, updateCoupon, type CouponFormState } from '@/lib/admin/coupons-actions';
import { AdminIcon } from '@/components/admin/AdminIcons';
import { SubmitButton } from '../SubmitButton';

export interface AdminCoupon {
  id: string;
  code: string;
  kind: 'percent' | 'fixed' | 'free_shipping';
  value: number;
  minTotal: number | null;
  endsAt: string | null;
  maxUses: number | null;
  active: boolean;
  uses: number;
  minQuantity: number | null;
  restrictedContact: string | null;
}

const KIND_LABELS: Record<AdminCoupon['kind'], string> = {
  percent: 'אחוז הנחה',
  fixed: 'סכום קבוע',
  free_shipping: 'משלוח חינם',
};

export function CouponsManager({ coupons }: { coupons: AdminCoupon[] }) {
  const [state, formAction] = useActionState<CouponFormState, FormData>(createCoupon, {
    status: 'idle',
  });
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ value: '', minTotal: '', minQuantity: '', endsAt: '', restrictedContact: '' });
  const [rowMessage, setRowMessage] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_22rem]">
      <div className="admin-card admin-table-wrap">
        <table className="admin-table w-full min-w-[36rem] text-small">
          <thead>
            <tr className="border-b border-rule text-caption text-muted">
              <th className="px-4 py-3 text-start">קוד</th>
              <th className="px-4 py-3 text-start">סוג</th>
              <th className="px-4 py-3 text-start">ערך</th>
              <th className="px-4 py-3 text-start">מינימום</th>
              <th className="px-4 py-3 text-start">תוקף עד</th>
              <th className="px-4 py-3 text-start">שימושים</th>
              <th className="px-4 py-3 text-start">מצב</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted">
                  אין קופונים עדיין.
                </td>
              </tr>
            ) : (
              coupons.map((coupon) => (
                <tr key={coupon.id} className="border-b border-rule/60">
                  <td dir="ltr" className="px-4 py-2.5 font-semibold">{coupon.code}</td>
                  <td className="px-4 py-2.5">{KIND_LABELS[coupon.kind]}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {coupon.kind === 'percent'
                      ? `${coupon.value}%`
                      : coupon.kind === 'fixed'
                        ? `${coupon.value} ₪`
                        : '—'}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {coupon.minTotal != null ? `${coupon.minTotal} ₪` : '—'}
                  </td>
                  <td dir="ltr" className="px-4 py-2.5 text-muted">
                    {coupon.endsAt ? coupon.endsAt.slice(0, 10) : '—'}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {coupon.uses}
                    {coupon.maxUses != null ? ` / ${coupon.maxUses}` : ''}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(() => setCouponActive(coupon.id, !coupon.active))
                      }
                      className={`admin-badge ${coupon.active ? 'admin-badge-success' : 'admin-badge-neutral'} admin-badge-button`}
                    >
                      {coupon.active ? 'פעיל' : 'כבוי'}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-end">
                    <span className="inline-flex gap-1">
                      <button
                        type="button"
                        aria-label={`עריכה — ${coupon.code}`}
                        onClick={() => {
                          setEditing(editing === coupon.id ? null : coupon.id);
                          setEditValues({
                            value: String(coupon.value),
                            minTotal: coupon.minTotal != null ? String(coupon.minTotal) : '',
                            minQuantity: coupon.minQuantity != null ? String(coupon.minQuantity) : '',
                            endsAt: coupon.endsAt ? coupon.endsAt.slice(0, 10) : '',
                            restrictedContact: coupon.restrictedContact ?? '',
                          });
                          setRowMessage(null);
                        }}
                        className="admin-btn admin-btn-ghost admin-btn-icon"
                      >
                        <AdminIcon name="edit" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`מחיקה — ${coupon.code}`}
                        onClick={() => {
                          if (!window.confirm(`למחוק את הקופון ${coupon.code}? פעולה בלתי הפיכה.`)) return;
                          startTransition(async () => {
                            const result = await deleteCoupon(coupon.id);
                            setRowMessage(result.error ?? (result.ok ? 'נמחק.' : 'המחיקה נכשלה'));
                          });
                        }}
                        className="admin-btn admin-btn-ghost admin-btn-icon"
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

      <div className="space-y-4 xl:sticky xl:top-6">
      {rowMessage ? (
        <p role="status" className="admin-card px-4 py-3 text-caption text-ink-soft">{rowMessage}</p>
      ) : null}
      {editing ? (
        <div className="admin-card space-y-3 px-5 py-4">
          <h2 className="text-small font-bold text-ink">
            עריכת {coupons.find((c) => c.id === editing)?.code}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-value" className="admin-field-label">ערך</label>
              <input id="edit-value" type="number" dir="ltr" min={0} value={editValues.value} onChange={(e) => setEditValues((v) => ({ ...v, value: e.target.value }))} className="admin-field-input" />
            </div>
            <div>
              <label htmlFor="edit-min" className="admin-field-label">מינימום ₪</label>
              <input id="edit-min" type="number" dir="ltr" min={0} value={editValues.minTotal} onChange={(e) => setEditValues((v) => ({ ...v, minTotal: e.target.value }))} className="admin-field-input" />
            </div>
            <div>
              <label htmlFor="edit-min-qty" className="admin-field-label">מינימום יחידות</label>
              <input id="edit-min-qty" type="number" dir="ltr" min={1} value={editValues.minQuantity} onChange={(e) => setEditValues((v) => ({ ...v, minQuantity: e.target.value }))} className="admin-field-input" />
            </div>
            <div>
              <label htmlFor="edit-ends" className="admin-field-label">תוקף עד</label>
              <input id="edit-ends" type="date" dir="ltr" value={editValues.endsAt} onChange={(e) => setEditValues((v) => ({ ...v, endsAt: e.target.value }))} className="admin-field-input" />
            </div>
          </div>
          <div>
            <label htmlFor="edit-contact" className="admin-field-label">קופון אישי — טלפון או מייל (ריק = לכולם)</label>
            <input id="edit-contact" dir="ltr" value={editValues.restrictedContact} onChange={(e) => setEditValues((v) => ({ ...v, restrictedContact: e.target.value }))} className="admin-field-input" />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const data = new FormData();
                  const current = coupons.find((c) => c.id === editing);
                  data.set('kind', current?.kind ?? 'percent');
                  data.set('value', editValues.value);
                  data.set('min_total', editValues.minTotal);
                  data.set('min_quantity', editValues.minQuantity);
                  data.set('max_uses', current?.maxUses != null ? String(current.maxUses) : '');
                  data.set('max_uses_per_customer', '1');
                  data.set('ends_at', editValues.endsAt ? new Date(`${editValues.endsAt}T23:59:59`).toISOString() : '');
                  data.set('restricted_contact', editValues.restrictedContact);
                  const result = await updateCoupon(editing, data);
                  setRowMessage(result.ok ? 'עודכן.' : (result.error ?? 'העדכון נכשל'));
                  if (result.ok) setEditing(null);
                })
              }
              className="admin-btn admin-btn-solid"
            >
              שמירה
            </button>
            <button type="button" onClick={() => setEditing(null)} className="admin-btn admin-btn-ghost">ביטול</button>
          </div>
        </div>
      ) : null}
      <form action={formAction} className="admin-card space-y-4 px-5 py-4">
        <h2 className="text-small font-bold text-ink">קופון חדש</h2>
        <div>
          <label htmlFor="coupon-new-code" className="admin-field-label">קוד</label>
          <input id="coupon-new-code" name="code" dir="ltr" required className="admin-field-input" placeholder="ELUL-25" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="coupon-new-kind" className="admin-field-label">סוג</label>
            <select id="coupon-new-kind" name="kind" className="admin-field-input">
              <option value="percent">אחוז הנחה</option>
              <option value="fixed">סכום קבוע (₪)</option>
              <option value="free_shipping">משלוח חינם</option>
            </select>
          </div>
          <div>
            <label htmlFor="coupon-new-value" className="admin-field-label">ערך</label>
            <input id="coupon-new-value" name="value" type="number" dir="ltr" min={0} step={0.5} className="admin-field-input" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="coupon-new-min" className="admin-field-label">סכום מינימום (₪)</label>
            <input id="coupon-new-min" name="min_total" type="number" dir="ltr" min={0} className="admin-field-input" />
          </div>
          <div>
            <label htmlFor="coupon-new-ends" className="admin-field-label">תוקף עד</label>
            <input id="coupon-new-ends" name="ends_at" type="date" dir="ltr" className="admin-field-input" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="coupon-new-max" className="admin-field-label">מקסימום שימושים</label>
            <input id="coupon-new-max" name="max_uses" type="number" dir="ltr" min={1} className="admin-field-input" placeholder="ללא הגבלה" />
          </div>
          <div>
            <label htmlFor="coupon-new-per" className="admin-field-label">שימושים ללקוח</label>
            <input id="coupon-new-per" name="max_uses_per_customer" type="number" dir="ltr" min={1} defaultValue={1} className="admin-field-input" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="coupon-new-minqty" className="admin-field-label">מינימום יחידות (קנה X)</label>
            <input id="coupon-new-minqty" name="min_quantity" type="number" dir="ltr" min={1} className="admin-field-input" placeholder="ללא" />
          </div>
          <div>
            <label htmlFor="coupon-new-contact" className="admin-field-label">קופון אישי (טלפון/מייל)</label>
            <input id="coupon-new-contact" name="restricted_contact" dir="ltr" className="admin-field-input" placeholder="לכולם" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-small text-ink-soft">
          <input type="checkbox" name="combinable_with_sale" className="h-4 w-4" />
          חל גם על ספרים במבצע
        </label>
        <label className="flex items-center gap-2 text-small text-ink-soft">
          <input type="checkbox" name="combinable_with_coupons" className="h-4 w-4" />
          ניתן לצירוף עם קופונים נוספים
          <span className="text-caption text-muted">(ברירת מחדל: לא — קופון אחד להזמנה)</span>
        </label>
        <div className="flex items-center gap-3">
          <SubmitButton pendingLabel="יוצר…">יצירת הקופון</SubmitButton>
          {state.status === 'saved' ? (
            <span role="status" className="text-caption text-ink-soft">נוצר.</span>
          ) : null}
          {state.status === 'error' ? (
            <span role="alert" className="text-caption text-[var(--admin-danger)]">{state.message}</span>
          ) : null}
        </div>
      </form>
      </div>
    </div>
  );
}
