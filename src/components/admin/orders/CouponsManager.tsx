'use client';

import { useActionState, useTransition } from 'react';
import { createCoupon, setCouponActive, type CouponFormState } from '@/lib/admin/coupons-actions';
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
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <form action={formAction} className="admin-card space-y-4 px-5 py-4 xl:sticky xl:top-6">
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
  );
}
