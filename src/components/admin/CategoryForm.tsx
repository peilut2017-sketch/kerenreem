'use client';

import { EntityForm } from './EntityForm';
import { FieldSet, TextField } from './Fields';
import type { Category } from '@/lib/supabase/types';

/**
 * קטגוריה היא שדה בחירה בטופס הספר, ולכן היא נדרשת לפני שאפשר לשייך אליה
 * ספר. עד כה היא הייתה מוגדרת בשרת אבל בלי מסך, כך שאפשר היה רק לבחור מבין
 * הקטגוריות שהגיעו מקובץ הזריעה.
 */
export function CategoryForm({
  category,
  bookCount,
  canWrite,
}: {
  category: Category | null;
  bookCount: number;
  canWrite: boolean;
}) {
  return (
    <EntityForm
      entity="categories"
      id={category?.id ?? null}
      canWrite={canWrite}
      backHref="/admin/categories"
    >
      {(errors) => (
        <>
          {bookCount > 0 ? (
            <p className="border-s-2 border-burgundy bg-cream-2 px-4 py-3 text-small text-ink-soft">
              {bookCount} ספרים משויכים לקטגוריה זו. מחיקתה לא תמחק אותם, אבל הם
              יישארו בלי קטגוריה ויֵצאו מהסינון בקטלוג — המסד מנתק את השיוך בשקט.
              שינוי מזהה הכתובת ישנה את כתובת הסינון.
            </p>
          ) : null}

          <FieldSet legend="שם הקטגוריה">
            <TextField
              name="name_he"
              label="שם (עברית)"
              required
              defaultValue={category?.name_he}
              error={errors.name_he}
            />
            <TextField
              name="slug"
              label="מזהה כתובת"
              required
              dir="auto"
              defaultValue={category?.slug}
              error={errors.slug}
              hint="אותיות לטיניות קטנות או עבריות, ספרות ומקפים, למשל halacha."
            />
            <TextField name="name_en" label="Name" dir="ltr" defaultValue={category?.name_en} />
          </FieldSet>

          <FieldSet legend="סדר">
            <TextField
              name="sort_order"
              label="סדר תצוגה"
              type="number"
              dir="ltr"
              defaultValue={category?.sort_order}
              hint="מספר נמוך מופיע קודם."
              error={errors.sort_order}
            />
          </FieldSet>
        </>
      )}
    </EntityForm>
  );
}
