'use client';

import { useActionState, useState } from 'react';
import { saveShippingMethod, type ShippingFormState } from '@/lib/admin/shipping-actions';
import { SubmitButton } from '../SubmitButton';
import type { ShippingMethod } from '@/lib/supabase/types';

const KIND_LABELS: Record<string, string> = {
  pickup: 'איסוף עצמי',
  flat: 'מחיר אחיד',
  by_weight: 'לפי משקל',
  by_total: 'לפי סכום',
  free_over: 'חינם מעל סף',
};

/** רשימת השיטות + טופס עריכה/יצירה אחד. הכל בעמוד — בלי ניווט משנה. */
export function ShippingManager({ methods }: { methods: ShippingMethod[] }) {
  const [selected, setSelected] = useState<ShippingMethod | null>(null);
  const [creating, setCreating] = useState(false);
  const [state, formAction] = useActionState<ShippingFormState, FormData>(saveShippingMethod, {
    status: 'idle',
  });

  const editing = creating ? null : selected;

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_24rem]">
      <div className="admin-card admin-table-wrap">
        <table className="admin-table w-full min-w-[38rem] text-small">
          <thead>
            <tr className="border-b border-rule text-caption text-muted">
              <th className="px-4 py-3 text-start">שיטה</th>
              <th className="px-4 py-3 text-start">סוג</th>
              <th className="px-4 py-3 text-start">מחיר</th>
              <th className="px-4 py-3 text-start">ימי עסקים</th>
              <th className="px-4 py-3 text-start">חינם מעל</th>
              <th className="px-4 py-3 text-start">מצב</th>
              <th className="px-4 py-3 text-start" />
            </tr>
          </thead>
          <tbody>
            {methods.map((method) => (
              <tr key={method.id} className="border-b border-rule/60">
                <td className="px-4 py-2.5 font-semibold">{method.name_he}</td>
                <td className="px-4 py-2.5">{KIND_LABELS[method.kind] ?? method.kind}</td>
                <td className="px-4 py-2.5 tabular-nums">{Number(method.price)} ₪</td>
                <td className="px-4 py-2.5 tabular-nums">{method.eta_business_days}</td>
                <td className="px-4 py-2.5 tabular-nums">
                  {method.free_over != null ? `${Number(method.free_over)} ₪` : '—'}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`admin-badge ${method.active ? 'admin-badge-success' : 'admin-badge-neutral'}`}>
                    {method.active ? 'פעילה' : 'כבויה'}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setSelected(method);
                    }}
                    className="admin-btn admin-btn-ghost"
                  >
                    עריכה
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-rule px-4 py-3">
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setCreating(true);
            }}
            className="admin-btn admin-btn-quiet"
          >
            + שיטה חדשה
          </button>
        </div>
      </div>

      {(editing || creating) ? (
        <form action={formAction} className="admin-card space-y-4 px-5 py-4 xl:sticky xl:top-6" key={editing?.id ?? 'new'}>
          <h2 className="text-small font-bold text-ink">
            {editing ? `עריכת ${editing.name_he}` : 'שיטה חדשה'}
          </h2>
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          {!editing ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="sm-slug" className="admin-field-label">מזהה (slug)</label>
                <input id="sm-slug" name="slug" dir="ltr" required className="admin-field-input" placeholder="express" />
              </div>
              <div>
                <label htmlFor="sm-kind" className="admin-field-label">סוג</label>
                <select id="sm-kind" name="kind" className="admin-field-input">
                  <option value="flat">מחיר אחיד</option>
                  <option value="by_weight">לפי משקל</option>
                  <option value="by_total">לפי סכום</option>
                  <option value="free_over">חינם מעל סף</option>
                  <option value="pickup">איסוף עצמי</option>
                </select>
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sm-name" className="admin-field-label">שם (עברית)</label>
              <input id="sm-name" name="name_he" required defaultValue={editing?.name_he ?? ''} className="admin-field-input" />
            </div>
            <div>
              <label htmlFor="sm-name-en" className="admin-field-label">שם (אנגלית)</label>
              <input id="sm-name-en" name="name_en" dir="ltr" defaultValue={editing?.name_en ?? ''} className="admin-field-input" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="sm-price" className="admin-field-label">מחיר (₪)</label>
              <input id="sm-price" name="price" type="number" dir="ltr" min={0} step={0.5} defaultValue={editing != null ? Number(editing.price) : 0} className="admin-field-input" />
            </div>
            <div>
              <label htmlFor="sm-eta" className="admin-field-label">ימי עסקים</label>
              <input id="sm-eta" name="eta_business_days" type="number" dir="ltr" min={0} defaultValue={editing?.eta_business_days ?? 3} className="admin-field-input" />
            </div>
            <div>
              <label htmlFor="sm-free" className="admin-field-label">חינם מעל (₪)</label>
              <input id="sm-free" name="free_over" type="number" dir="ltr" min={0} defaultValue={editing?.free_over != null ? Number(editing.free_over) : ''} className="admin-field-input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sm-min-w" className="admin-field-label">משקל מינ׳ (גרם)</label>
              <input id="sm-min-w" name="min_weight_grams" type="number" dir="ltr" min={0} defaultValue={editing?.min_weight_grams ?? ''} className="admin-field-input" />
            </div>
            <div>
              <label htmlFor="sm-max-w" className="admin-field-label">משקל מקס׳ (גרם)</label>
              <input id="sm-max-w" name="max_weight_grams" type="number" dir="ltr" min={0} defaultValue={editing?.max_weight_grams ?? ''} className="admin-field-input" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="sm-min-t" className="admin-field-label">סכום הזמנה מינ׳ (₪)</label>
              <input id="sm-min-t" name="min_total" type="number" dir="ltr" min={0} defaultValue={editing?.min_total != null ? Number(editing.min_total) : ''} className="admin-field-input" />
            </div>
            <div>
              <label htmlFor="sm-max-t" className="admin-field-label">סכום הזמנה מקס׳ (₪)</label>
              <input id="sm-max-t" name="max_total" type="number" dir="ltr" min={0} defaultValue={editing?.max_total != null ? Number(editing.max_total) : ''} className="admin-field-input" />
            </div>
            <div>
              <label htmlFor="sm-sort" className="admin-field-label">סדר תצוגה</label>
              <input id="sm-sort" name="sort_order" type="number" dir="ltr" defaultValue={editing?.sort_order ?? 0} className="admin-field-input" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-small text-ink-soft">
            <input type="checkbox" name="active" defaultChecked={editing?.active ?? true} className="h-4 w-4" />
            שיטה פעילה
          </label>
          <div className="flex items-center gap-3">
            <SubmitButton pendingLabel="שומר…">שמירה</SubmitButton>
            {state.status === 'saved' ? (
              <span role="status" className="text-caption text-ink-soft">נשמר.</span>
            ) : null}
            {state.status === 'error' ? (
              <span role="alert" className="text-caption text-[var(--admin-danger)]">{state.message}</span>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="admin-card px-5 py-6 text-small text-muted">
          בחרו שיטה לעריכה, או צרו חדשה.
        </p>
      )}
    </div>
  );
}
