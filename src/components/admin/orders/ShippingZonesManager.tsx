'use client';

import { useActionState, useState, useTransition } from 'react';
import { deleteShippingZone, saveShippingZone, type ShippingFormState } from '@/lib/admin/shipping-actions';
import { SubmitButton } from '../SubmitButton';
import type { ShippingZone } from '@/lib/supabase/types';

const KIND_LABELS: Record<string, string> = {
  include: 'כולל (רק הערים ברשימה)',
  exclude: 'מוציא (כל עיר חוץ מהרשימה)',
};

/**
 * [1.6] ניהול אזורי משלוח (ט.16) — טבלה + טופס עריכה/יצירה, אותו דפוס
 * בדיוק כמו ShippingManager. ערים כטקסט חופשי מופרד בפסיקים/שורות —
 * אין מאגר ערים קנוני במסד לבחור מתוכו.
 */
export function ShippingZonesManager({ zones }: { zones: ShippingZone[] }) {
  const [selected, setSelected] = useState<ShippingZone | null>(null);
  const [creating, setCreating] = useState(false);
  const [state, formAction] = useActionState<ShippingFormState, FormData>(saveShippingZone, {
    status: 'idle',
  });
  const [deleteState, setDeleteState] = useState<ShippingFormState>({ status: 'idle' });
  const [pending, startTransition] = useTransition();

  const editing = creating ? null : selected;

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_24rem]">
      <div className="admin-card admin-table-wrap">
        <table className="admin-table w-full min-w-[34rem] text-small">
          <thead>
            <tr className="border-b border-rule text-caption text-muted">
              <th className="px-4 py-3 text-start">אזור</th>
              <th className="px-4 py-3 text-start">סוג</th>
              <th className="px-4 py-3 text-start">ערים</th>
              <th className="px-4 py-3 text-start">מצב</th>
              <th className="px-4 py-3 text-start" />
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => (
              <tr key={zone.id} className="border-b border-rule/60">
                <td className="px-4 py-2.5 font-semibold">{zone.name}</td>
                <td className="px-4 py-2.5">{KIND_LABELS[zone.kind] ?? zone.kind}</td>
                <td className="max-w-2xs truncate px-4 py-2.5 text-muted" title={zone.cities.join(', ')}>
                  {zone.cities.length > 0 ? zone.cities.join(', ') : '—'}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`admin-badge ${zone.active ? 'admin-badge-success' : 'admin-badge-neutral'}`}>
                    {zone.active ? 'פעיל' : 'כבוי'}
                  </span>
                </td>
                <td className="flex gap-2 px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setSelected(zone);
                    }}
                    className="admin-btn admin-btn-ghost"
                  >
                    עריכה
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm(`למחוק את האזור "${zone.name}"? שיטות משויכות יהפכו זמינות לכל עיר.`)) return;
                      startTransition(async () => {
                        const result = await deleteShippingZone(zone.id);
                        setDeleteState(result);
                        if (result.status === 'saved' && selected?.id === zone.id) setSelected(null);
                      });
                    }}
                    className="admin-btn admin-btn-ghost"
                  >
                    מחיקה
                  </button>
                </td>
              </tr>
            ))}
            {zones.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  אין עדיין אזורי משלוח — כל השיטות זמינות לכל עיר.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div className="flex items-center gap-3 border-t border-rule px-4 py-3">
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setCreating(true);
            }}
            className="admin-btn admin-btn-quiet"
          >
            + אזור חדש
          </button>
          {deleteState.status === 'error' ? (
            <span role="alert" className="text-caption text-[var(--admin-danger)]">{deleteState.message}</span>
          ) : null}
        </div>
      </div>

      {editing || creating ? (
        <form action={formAction} className="admin-card space-y-4 px-5 py-4 xl:sticky xl:top-6" key={editing?.id ?? 'new'}>
          <h2 className="text-small font-bold text-ink">{editing ? `עריכת ${editing.name}` : 'אזור חדש'}</h2>
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <div>
            <label htmlFor="sz-name" className="admin-field-label">שם האזור</label>
            <input id="sz-name" name="name" required defaultValue={editing?.name ?? ''} className="admin-field-input" placeholder="גוש דן, פריפריה…" />
          </div>
          <div>
            <label htmlFor="sz-kind" className="admin-field-label">סוג</label>
            <select id="sz-kind" name="kind" defaultValue={editing?.kind ?? 'include'} className="admin-field-input">
              <option value="include">כולל — רק הערים ברשימה</option>
              <option value="exclude">מוציא — כל עיר חוץ מהרשימה</option>
            </select>
          </div>
          <div>
            <label htmlFor="sz-cities" className="admin-field-label">ערים</label>
            <textarea
              id="sz-cities"
              name="cities"
              rows={5}
              defaultValue={editing?.cities.join('\n') ?? ''}
              className="admin-field-input"
              placeholder={'עיר אחת בכל שורה, או מופרדות בפסיקים:\nתל אביב\nחיפה\nירושלים'}
            />
          </div>
          <div>
            <label htmlFor="sz-notes" className="admin-field-label">הערה פנימית (רשות)</label>
            <input id="sz-notes" name="notes" defaultValue={editing?.notes ?? ''} className="admin-field-input" />
          </div>
          <label className="flex items-center gap-2 text-small text-ink-soft">
            <input type="checkbox" name="active" defaultChecked={editing?.active ?? true} className="h-4 w-4" />
            אזור פעיל
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
        <p className="admin-card px-5 py-6 text-small text-muted">בחרו אזור לעריכה, או צרו חדש.</p>
      )}
    </div>
  );
}
