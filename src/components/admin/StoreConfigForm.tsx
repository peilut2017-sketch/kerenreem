'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { ToggleField, FieldSet, SelectField, TextField } from './Fields';
import { SubmitButton } from './SubmitButton';
import { saveStoreConfig, toggleStoreConfigFlag, type StoreConfigState } from '@/lib/admin/store-config-actions';
import { showAdminToast } from '@/lib/admin/toast-bus';
import { useUnsavedChangesWarning } from './useUnsavedChangesWarning';
import type { StoreSettings } from '@/lib/supabase/types';

/**
 * טופס הגדרות החנות: הדגלים השכבתיים (כל שכבה פעילה רק כשהשכבות
 * שתחתיה פעילות — נאכף בקוד הצריכה) והתצורה הכספית/תפעולית.
 * מתג-העל "חנות פעילה" נשאר בטופס הנפרד שמעל — בכוונה.
 */
export function StoreConfigForm({
  settings,
  morningConfigured,
}: {
  settings: StoreSettings;
  /** [1.4] isMorningConfigured() בשרת — אין UI צרכן אחד עד עכשיו, והממשק
   * דיווח "סליקה פעילה" גם כשאין מפתחות בסביבה (הפעולה עצמה נאכפת ב-
   * saveStoreConfig, כאן רק משקפים את המצב באמת לפני שהמנהל מנסה). */
  morningConfigured: boolean;
}) {
  const [state, formAction] = useActionState<StoreConfigState, FormData>(saveStoreConfig, {
    status: 'idle',
  });
  const formRef = useRef<HTMLFormElement>(null);
  // שינויים שלא נשמרו — אותו דפוס כמו SettingsForm: זוכרים איזו תגובת
  // שרת הייתה על המסך כשנגעו בטופס; תגובת "נשמר" חדשה מאפסת מעצמה.
  const [touchedAt, setTouchedAt] = useState<StoreConfigState | null>(null);
  const dirty = touchedAt !== null && (touchedAt === state || state.status !== 'saved');
  useUnsavedChangesWarning(dirty);

  useEffect(() => {
    if (state.status !== 'saved') return;
    showAdminToast(state.message ?? 'הנתונים נשמרו בהצלחה');
  }, [state]);

  // [1.10] Ctrl/Cmd+Enter שולח את הטופס כמו כפתור "שמירה" — ראו אותה
  // תוספת ב-EntityForm.tsx.
  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onKeyDown={handleKeyDown}
      onChange={(event) => {
        // מתגי autoSave (ToggleField עם onToggle) נשמרים מיד בעצמם — לא חלק
        // מהשמירה הכוללת של הטופס, ואין להם מה "לאבד" ביציאה.
        if ((event.target as HTMLElement).closest('[data-autosave]')) return;
        setTouchedAt(state);
      }}
      className="space-y-8"
    >
      <FieldSet
        legend="דגלים שכבתיים"
        icon="store"
        description="כל שכבה נשענת על שמתחתיה: עגלה מחייבת מחירים, קופה מחייבת עגלה, סליקה מחייבת קופה. אפשר להעלות שכבה לאוויר בשקט ולבדוק לפני שפותחים את הבאה."
      >
        {!morningConfigured ? (
          <p
            role="status"
            className="mb-3 rounded-[var(--radius-sm)] bg-[var(--admin-warning-soft)] px-3 py-2.5 text-caption text-[var(--admin-warning)]"
          >
            ⚠ מורנינג אינה מחוברת (מפתחות API חסרים בסביבה) — לא ניתן להפעיל סליקה כרגע.
          </p>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <ToggleField
            name="show_prices"
            label="הצגת מחירים"
            defaultChecked={settings.show_prices}
            onToggle={(next) => toggleStoreConfigFlag('show_prices', next)}
          />
          <ToggleField
            name="cart_enabled"
            label="עגלה ו-Mini Cart"
            defaultChecked={settings.cart_enabled}
            onToggle={(next) => toggleStoreConfigFlag('cart_enabled', next)}
          />
          <ToggleField
            name="checkout_enabled"
            label="קופה (Checkout)"
            defaultChecked={settings.checkout_enabled}
            onToggle={(next) => toggleStoreConfigFlag('checkout_enabled', next)}
          />
          <ToggleField
            name="payments_enabled"
            label="סליקה במורנינג"
            defaultChecked={settings.payments_enabled && morningConfigured}
            disabled={!morningConfigured}
            hint={
              morningConfigured
                ? 'אין להפעיל לפני השלמת אימותי ה-Sandbox ותנאי הפתיחה שבאפיון.'
                : 'חסום: אין מפתחות מורנינג בסביבה (MORNING_API_KEY_ID / MORNING_API_SECRET).'
            }
            onToggle={(next) => toggleStoreConfigFlag('payments_enabled', next)}
          />
          <ToggleField
            name="express_checkout_enabled"
            label="מסלול אקספרס (ביט / ארנקים)"
            defaultChecked={settings.express_checkout_enabled && morningConfigured}
            disabled={!morningConfigured}
            hint="רק אחרי שאימות 9.3.1 — קביעת אמצעי מראש ב-API — הוכרע."
            onToggle={(next) => toggleStoreConfigFlag('express_checkout_enabled', next)}
          />
          <ToggleField
            name="accounts_enabled"
            label="חשבונות לקוח"
            defaultChecked={settings.accounts_enabled}
            onToggle={(next) => toggleStoreConfigFlag('accounts_enabled', next)}
          />
          <ToggleField
            name="returns_enabled"
            label="בקשות ביטול והחזרה"
            defaultChecked={settings.returns_enabled}
            onToggle={(next) => toggleStoreConfigFlag('returns_enabled', next)}
          />
          <ToggleField
            name="coupons_enabled"
            label="קופונים"
            defaultChecked={settings.coupons_enabled}
            onToggle={(next) => toggleStoreConfigFlag('coupons_enabled', next)}
          />
          <ToggleField
            name="donations_enabled"
            label="תוספת תרומה"
            defaultChecked={settings.donations_enabled}
            onToggle={(next) => toggleStoreConfigFlag('donations_enabled', next)}
          />
          <ToggleField
            name="recommendations_enabled"
            label="המלצות (נקנו יחד)"
            defaultChecked={settings.recommendations_enabled}
            onToggle={(next) => toggleStoreConfigFlag('recommendations_enabled', next)}
          />
        </div>
      </FieldSet>

      <FieldSet legend="משלוח ותשלומים" icon="store">
        <div className="grid gap-5 sm:grid-cols-3">
          <TextField
            name="free_shipping_threshold"
            label="סף משלוח חינם (₪)"
            type="number"
            dir="ltr"
            min={0}
            defaultValue={settings.free_shipping_threshold}
            hint="ריק = אין משלוח חינם. מזין את פס ההתקדמות בעגלה."
          />
          <TextField
            name="installments_min_total"
            label="סף תשלומים (₪)"
            type="number"
            dir="ltr"
            min={0}
            defaultValue={settings.installments_min_total}
          />
          <TextField
            name="installments_max"
            label="מקסימום תשלומים"
            type="number"
            dir="ltr"
            min={1}
            defaultValue={settings.installments_max}
            hint="באשראי בלבד; ביט וארנקים — תשלום אחד."
          />
        </div>
      </FieldSet>

      <FieldSet legend="מסמך חשבונאי ומע״מ" icon="store">
        <div className="grid gap-5 sm:grid-cols-3">
          <SelectField
            name="document_type"
            label="סוג המסמך במורנינג"
            defaultValue={settings.document_type}
            options={[
              { value: 'invoice_receipt', label: 'חשבונית מס־קבלה' },
              { value: 'receipt', label: 'קבלה' },
              { value: 'donation_receipt', label: 'קבלה על תרומה' },
            ]}
            hint="לפי הנחיית רואה החשבון (החלטה 3 באפיון)."
          />
          <SelectField
            name="vat_mode"
            label="מע״מ"
            defaultValue={settings.vat_mode}
            options={[
              { value: 'included', label: 'המחירים כוללים מע״מ' },
              { value: 'exempt', label: 'פטור ממע״מ' },
            ]}
          />
          <TextField
            name="vat_rate"
            label="שיעור מע״מ (%)"
            type="number"
            dir="ltr"
            min={0}
            step={0.5}
            defaultValue={settings.vat_rate}
          />
        </div>
      </FieldSet>

      <FieldSet
        legend="זמני הכנה ואספקה"
        icon="store"
        description="תאריך ההבטחה ללקוח = היום + הכנה + ימי השיטה + מרווח ביטחון, בדילוג על שישי, שבת, חגים וערבי חג."
      >
        <div className="grid gap-5 sm:grid-cols-3">
          <TextField name="order_prep_days" label="ימי הכנה להזמנה" type="number" dir="ltr" min={0} defaultValue={settings.order_prep_days} />
          <TextField name="delivery_buffer_days" label="מרווח ביטחון (ימים)" type="number" dir="ltr" min={0} defaultValue={settings.delivery_buffer_days} />
          <TextField name="low_stock_threshold" label="סף מלאי נמוך כללי" type="number" dir="ltr" min={0} defaultValue={settings.low_stock_threshold} />
        </div>
      </FieldSet>

      <FieldSet legend="איסוף עצמי" icon="store">
        <ToggleField
          name="pickup_enabled"
          label="איסוף עצמי פעיל"
          defaultChecked={settings.pickup_enabled}
          onToggle={(next) => toggleStoreConfigFlag('pickup_enabled', next)}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="pickup_address"
            label="כתובת האיסוף"
            defaultValue={(settings.pickup_address?.text as string) ?? ''}
          />
          <TextField name="pickup_hours" label="שעות איסוף" defaultValue={settings.pickup_hours} />
        </div>
        <TextField
          name="pickup_prep_hours"
          label="זמן הכנה לאיסוף (שעות)"
          type="number"
          dir="ltr"
          min={0}
          defaultValue={settings.pickup_prep_hours}
        />
      </FieldSet>

      <FieldSet legend="שירות" icon="store">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="support_phone"
            label="טלפון להזמנות ועזרה"
            dir="ltr"
            defaultValue={settings.support_phone}
            hint="מוצג בקופה: ״מעדיפים להזמין בטלפון? נשמח לעזור״."
          />
          <TextField
            name="add_to_order_window_hours"
            label="חלון ״הוסף להזמנה״ (שעות)"
            type="number"
            dir="ltr"
            min={0}
            defaultValue={settings.add_to_order_window_hours}
          />
        </div>
      </FieldSet>

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="שומר…">שמירת הגדרות החנות</SubmitButton>
        {state.status === 'saved' ? (
          <span role="status" className={`text-small ${state.message ? 'text-[var(--admin-warning)]' : 'text-ink-soft'}`}>
            {state.message ?? 'ההגדרות נשמרו.'}
          </span>
        ) : null}
        {state.status === 'error' ? (
          <span role="alert" className="text-small text-[var(--admin-danger)]">
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
