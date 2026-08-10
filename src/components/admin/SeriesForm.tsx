'use client';

import { EntityForm } from './EntityForm';
import { FieldSet, TextAreaField, TextField } from './Fields';
import type { Series } from '@/lib/supabase/types';

/**
 * סדרה היא ישות בפני עצמה ולא שדה טקסט חופשי על הספר (ראו
 * 10_book_page_stage_c.sql) — כדי לשייך ספר לסדרה, הסדרה צריכה להיווצר
 * כאן קודם.
 */
export function SeriesForm({
  series,
  bookCount,
  canWrite,
}: {
  series: Series | null;
  bookCount: number;
  canWrite: boolean;
}) {
  return (
    <EntityForm entity="series" id={series?.id ?? null} canWrite={canWrite} backHref="/admin/series">
      {(errors) => (
        <>
          {bookCount > 0 ? (
            <p className="border-s-2 border-burgundy bg-cream-2 px-4 py-3 text-small text-ink-soft">
              {bookCount} ספרים משויכים לסדרה זו. מחיקתה לא תמחק אותם, אבל הם
              יישארו בלי שיוך לסדרה — המסד מנתק את השיוך בשקט.
            </p>
          ) : null}

          <FieldSet legend="שם הסדרה">
            <TextField
              name="name_he"
              label="שם (עברית)"
              required
              defaultValue={series?.name_he}
              error={errors.name_he}
            />
            <TextField
              name="slug"
              label="מזהה כתובת"
              required
              dir="auto"
              defaultValue={series?.slug}
              error={errors.slug}
              hint="אותיות לטיניות קטנות או עבריות, ספרות ומקפים."
            />
            <TextField name="name_en" label="Name" dir="ltr" defaultValue={series?.name_en} />
          </FieldSet>

          <FieldSet legend="תיאור">
            <TextAreaField
              name="description_he"
              label="תיאור הסדרה (עברית)"
              defaultValue={series?.description_he}
              hint="אופציונלי. משפט או שניים על הסדרה."
            />
          </FieldSet>
        </>
      )}
    </EntityForm>
  );
}
