'use client';

import { useActionState } from 'react';
import { CheckboxField, FieldSet, SelectField, TextField } from './Fields';
import { SubmitButton } from './SubmitButton';
import { saveStoreConfig, type StoreConfigState } from '@/lib/admin/store-config-actions';
import type { StoreSettings } from '@/lib/supabase/types';

/**
 * טופס הגדרות החנות: הדגלים השכבתיים (כל שכבה פעילה רק כשהשכבות
 * שתחתיה פעילות — נאכף בקוד הצריכה) והתצורה הכספית/תפעולית.
 * מתג-העל "חנות פעילה" נשאר בטופס הנפרד שמעל — בכוונה.
 */
export function StoreConfigForm({ settings }: { settings: StoreSettings }) {
  const [state, formAction] = useActionState<StoreConfigState, FormData>(saveStoreConfig, {
    status: 'idle',
  });

  return (
    <form action={formAction} className="space-y-8">
      <FieldSet
        legend="דגלים שכבתיים"
        icon="store"
        description="כל שכבה נשענת על שמתחתיה: עגלה מחייבת מחירים, קופה מחייבת עגלה, סליקה מחייבת קופה. אפשר להעלות שכבה לאוויר בשקט ולבדוק לפני שפותחים את הבאה."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <CheckboxField name="show_prices" label="הצגת מחירים" defaultChecked={settings.show_prices} />
          <CheckboxField name="cart_enabled" label="עגלה ו-Mini Cart" defaultChecked={settings.cart_enabled} />
          <CheckboxField name="checkout_enabled" label="קופה (Checkout)" defaultChecked={settings.checkout_enabled} />
          <CheckboxField
            name="payments_enabled"
            label="סליקה במורנינג"
            defaultChecked={settings.payments_enabled}
            hint="אין להפעיל לפני השלמת אימותי ה-Sandbox ותנאי הפתיחה שבאפיון."
          />
          <CheckboxField
            name="express_checkout_enabled"
            label="מסלול אקספרס (ביט / ארנקים)"
            defaultChecked={settings.express_checkout_enabled}
            hint="רק אחרי שאימות 9.3.1 — קביעת אמצעי מראש ב-API — הוכרע."
          />
          <CheckboxField name="accounts_enabled" label="חשבונות לקוח" defaultChecked={settings.accounts_enabled} />
          <CheckboxField name="returns_enabled" label="בקשות ביטול והחזרה" defaultChecked={settings.returns_enabled} />
          <CheckboxField name="coupons_enabled" label="קופונים" defaultChecked={settings.coupons_enabled} />
          <CheckboxField name="donations_enabled" label="תוספת תרומה" defaultChecked={settings.donations_enabled} />
          <CheckboxField name="recommendations_enabled" label="המלצות (נקנו יחד)" defaultChecked={settings.recommendations_enabled} />
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
        <CheckboxField name="pickup_enabled" label="איסוף עצמי פעיל" defaultChecked={settings.pickup_enabled} />
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
          <span role="status" className="text-small text-ink-soft">
            ההגדרות נשמרו.
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
