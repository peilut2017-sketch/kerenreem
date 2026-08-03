'use client';

import { useActionState } from 'react';
import { saveStoreSettings, type StoreSettingsState } from '@/lib/admin/settings-actions';
import { CheckboxField, FieldSet } from './Fields';
import type { SiteSettings } from '@/lib/supabase/types';

const INITIAL: StoreSettingsState = { status: 'idle' };

/**
 * הגדרת הפעלת החנות — טופס נפרד מהגדרות האתר הכלליות, חי תחת "ספרים"
 * כי היא שייכת לקטלוג ולא לזהות הארגון. ראו saveStoreSettings בסיבה
 * שהשמירה שלה נפרדת מ-saveSettings הרגילה.
 */
export function StoreSettingsForm({ settings }: { settings: SiteSettings }) {
  const [state, action, pending] = useActionState(saveStoreSettings, INITIAL);

  return (
    <form action={action} className="space-y-8">
      <FieldSet
        legend="הפעלת החנות"
        description="הפעלת החנות חושפת מחירים וכפתורי רכישה בעמודי הספרים שסומנו כניתנים לרכישה. אין להפעיל לפני חיבור ספק סליקה ופרסום תנאי רכישה, ביטול והחזרים בתקנון."
      >
        <CheckboxField name="store_enabled" label="חנות פעילה" defaultChecked={settings.store_enabled} />
      </FieldSet>

      {state.status === 'error' ? (
        <p role="alert" className="admin-card border-s-2 border-s-[var(--admin-danger)] px-4 py-3 text-small">
          {state.message}
        </p>
      ) : null}
      {state.status === 'saved' ? (
        <p role="status" className="admin-badge admin-badge-success">
          <span className="admin-badge-dot" aria-hidden="true" />
          ההגדרות נשמרו
        </p>
      ) : null}

      <div className="border-t border-rule pt-6">
        <button type="submit" disabled={pending} className="admin-btn admin-btn-solid">
          {pending ? 'שומר…' : 'שמירה'}
        </button>
      </div>
    </form>
  );
}
