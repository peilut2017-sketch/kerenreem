'use client';

import { EntityForm } from './EntityForm';
import { ToggleField, FieldSet, TextField } from './Fields';
import type { ContactTopic } from '@/lib/supabase/types';

/**
 * תחום פנייה (support/ספרים/הזמנות...) — מוצג כבורר רשות בטופס יצירת
 * הקשר הציבורי, רק כשיש לפחות תחום אחד מפורסם. סדר התצוגה נקבע לפי
 * sort_order, לא לפי סדר יצירה.
 */
export function ContactTopicForm({
  topic,
  canWrite,
}: {
  topic: ContactTopic | null;
  canWrite: boolean;
}) {
  return (
    <EntityForm entity="contact_topics" id={topic?.id ?? null} canWrite={canWrite} backHref="/admin/contact-topics">
      {(errors) => (
        <>
          <FieldSet legend="שם התחום">
            <TextField
              name="name_he"
              label="שם (עברית)"
              required
              defaultValue={topic?.name_he}
              error={errors.name_he}
            />
            <TextField name="name_en" label="Name" dir="ltr" defaultValue={topic?.name_en} />
          </FieldSet>

          <FieldSet legend="תצוגה">
            <TextField
              name="sort_order"
              label="סדר תצוגה"
              type="number"
              dir="ltr"
              defaultValue={topic?.sort_order ?? 0}
              hint="מספר קטן יותר מוצג קודם."
            />
            <ToggleField
              name="is_published"
              label="מוצג בטופס הציבורי"
              hint="ביטול הסימון מסתיר את התחום מהטופס בלי למחוק אותו."
              defaultChecked={topic?.is_published ?? true}
              entityKey="contact_topics"
              id={topic?.id}
            />
          </FieldSet>
        </>
      )}
    </EntityForm>
  );
}
