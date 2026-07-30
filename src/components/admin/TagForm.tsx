'use client';

import { EntityForm } from './EntityForm';
import { FieldSet, TextAreaField, TextField } from './Fields';
import type { Tag } from '@/lib/supabase/types';

/**
 * description_he הוא ההסבר שמוצג ב-Tooltip של התגית בעמוד הספר ("למה
 * קיבל את התג הזה"). אופציונלי: תגיות מערכת (חדש, רב מכר) מקבלות הסבר
 * קבוע בקוד גם בלעדיו.
 */
export function TagForm({
  tag,
  bookCount,
  canWrite,
}: {
  tag: Tag | null;
  bookCount: number;
  canWrite: boolean;
}) {
  return (
    <EntityForm entity="tags" id={tag?.id ?? null} canWrite={canWrite} backHref="/admin/tags">
      {(errors) => (
        <>
          {tag?.is_system ? (
            <p className="border-s-2 border-gold-deep bg-cream-2 px-4 py-3 text-small text-ink-soft">
              תגית מערכת — נוצרה אוטומטית ואי אפשר למחוק אותה מהממשק.
            </p>
          ) : null}

          {bookCount > 0 ? (
            <p className="border-s-2 border-burgundy bg-cream-2 px-4 py-3 text-small text-ink-soft">
              {bookCount} ספרים נושאים תגית זו. מחיקתה תסיר אותה מכולם.
            </p>
          ) : null}

          <FieldSet legend="שם התגית">
            <TextField
              name="name_he"
              label="שם (עברית)"
              required
              defaultValue={tag?.name_he}
              error={errors.name_he}
            />
            <TextField
              name="slug"
              label="מזהה כתובת"
              required
              dir="ltr"
              defaultValue={tag?.slug}
              error={errors.slug}
              hint="אותיות לטיניות קטנות ומקפים בלבד."
            />
            <TextField name="name_en" label="Name" dir="ltr" defaultValue={tag?.name_en} />
          </FieldSet>

          <FieldSet legend="הסבר">
            <TextAreaField
              name="description_he"
              label="למה מקבלים את התגית הזו"
              defaultValue={tag?.description_he}
              hint="מוצג ב-Tooltip בעמוד הספר בעת מעבר עכבר על התגית. אופציונלי."
            />
          </FieldSet>
        </>
      )}
    </EntityForm>
  );
}
