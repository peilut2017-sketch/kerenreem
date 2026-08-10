'use client';

import { EntityForm } from './EntityForm';
import { ToggleField, FieldSet, SelectField, TextAreaField, TextField } from './Fields';
import type { ContactField } from '@/lib/supabase/types';

const FIELD_TYPE_OPTIONS = [
  { value: 'text', label: 'טקסט קצר (שורה אחת)' },
  { value: 'textarea', label: 'טקסט ארוך (כמה שורות)' },
  { value: 'select', label: 'רשימה נפתחת' },
  { value: 'checkbox', label: 'תיבת סימון (כן/לא)' },
];

/**
 * שדה מותאם אישית לטופס יצירת הקשר — שאלה נוספת שהצוות מוסיף בלי לגעת
 * בקוד. תשובות הפונים נשמרות ב-contact_messages.custom_field_values,
 * במפתח contact_fields.id — ולכן אין כאן slug: המזהה עצמו הוא המפתח.
 *
 * שדה האפשרויות מוצג תמיד ולא רק כשסוג השדה הוא "רשימה נפתחת": טופס זה
 * נטען כרכיב שרת ואינו יודע בזמן הרינדור מהו הסוג הנבחר כרגע בטופס (לפני
 * שמירה). ההסבר בהינט מספיק כדי שלא יבלבל בסוגים האחרים, ופשוט יותר
 * מלהפוך את כל הטופס לרכיב לקוח רק בשביל הצגה מותנית.
 */
export function ContactFieldForm({
  field,
  canWrite,
}: {
  field: ContactField | null;
  canWrite: boolean;
}) {
  return (
    <EntityForm entity="contact_fields" id={field?.id ?? null} canWrite={canWrite} backHref="/admin/contact-fields">
      {(errors) => (
        <>
          <FieldSet legend="השאלה">
            <TextField
              name="label_he"
              label="תווית (עברית)"
              required
              defaultValue={field?.label_he}
              error={errors.label_he}
              hint="הטקסט שהפונה רואה מעל השדה, למשל ״מספר הזמנה״."
            />
            <TextField name="label_en" label="Label" dir="ltr" defaultValue={field?.label_en} />
          </FieldSet>

          <FieldSet legend="סוג השדה">
            <SelectField
              name="field_type"
              label="סוג"
              required
              defaultValue={field?.field_type ?? 'text'}
              options={FIELD_TYPE_OPTIONS}
              error={errors.field_type}
            />
            <TextAreaField
              name="options_he"
              label="אפשרויות (עברית)"
              rows={4}
              defaultValue={field?.options_he}
              hint="רק לסוג ״רשימה נפתחת״ — שורה אחת לכל אפשרות. מתעלמים ממנו בשאר הסוגים."
            />
            <TextAreaField
              name="options_en"
              label="Options (English)"
              dir="ltr"
              rows={4}
              defaultValue={field?.options_en}
            />
          </FieldSet>

          <FieldSet legend="תצוגה">
            <ToggleField
              name="is_required"
              label="שדה חובה"
              hint="הפונה לא יוכל לשלוח את הטופס בלי למלא אותו."
              defaultChecked={field?.is_required ?? false}
              entityKey="contact_fields"
              id={field?.id}
            />
            <TextField
              name="sort_order"
              label="סדר תצוגה"
              type="number"
              dir="ltr"
              defaultValue={field?.sort_order ?? 0}
              hint="מספר קטן יותר מוצג קודם, אחרי השדות הקבועים של הטופס."
            />
            <ToggleField
              name="is_published"
              label="מוצג בטופס הציבורי"
              hint="ביטול הסימון מסתיר את השדה מהטופס בלי למחוק את התשובות שכבר נאספו."
              defaultChecked={field?.is_published ?? true}
              entityKey="contact_fields"
              id={field?.id}
            />
          </FieldSet>
        </>
      )}
    </EntityForm>
  );
}
