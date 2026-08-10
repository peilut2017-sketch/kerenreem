'use client';

import { AuthorTimelineField } from './AuthorTimelineField';
import { EntityForm } from './EntityForm';
import { CheckboxField, FieldSet, TextField } from './Fields';
import { ImageField } from './ImageField';
import { RichTextEditor } from './RichTextEditor';
import type { Author } from '@/lib/supabase/types';

export function AuthorForm({
  author,
  bookCount,
  canWrite,
}: {
  author: Author | null;
  bookCount: number;
  canWrite: boolean;
}) {
  return (
    <EntityForm entity="authors" id={author?.id ?? null} canWrite={canWrite} backHref="/admin/authors">
      {(errors) => (
        <>
          {bookCount > 0 ? (
            <p className="border-s-2 border-burgundy bg-cream-2 px-4 py-3 text-small text-ink-soft">
              {bookCount} ספרים משויכים למחבר זה. מחיקתו לא תמחק אותם, אבל הם
              יישארו בלי ייחוס — המסד מנתק את השיוך בשקט ואי אפשר לשחזר אותו
              בלי לשייך כל ספר מחדש.
            </p>
          ) : null}

          <FieldSet legend="זיהוי">
            <TextField
              name="name_he"
              label="שם (עברית)"
              required
              defaultValue={author?.name_he}
              error={errors.name_he}
            />
            <TextField
              name="slug"
              label="מזהה כתובת"
              required
              dir="auto"
              defaultValue={author?.slug}
              error={errors.slug}
              hint="/authors/מזהה — אותיות לטיניות קטנות או עבריות, ספרות ומקפים."
            />
            <TextField name="name_en" label="Name" dir="ltr" defaultValue={author?.name_en} />
          </FieldSet>

          <FieldSet
            legend="שנים"
            description="טקסט חופשי — מאפשר שנה עברית (תר״ף) או לועזית, לפי המקור התיעודי."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField name="birth_year" label="שנת לידה" defaultValue={author?.birth_year} />
              <TextField name="death_year" label="שנת פטירה" defaultValue={author?.death_year} />
            </div>
          </FieldSet>

          <FieldSet legend="דיוקן">
            <ImageField
              name="portrait_url"
              label="תמונה"
              bucket="portraits"
              defaultValue={author?.portrait_url}
            />
          </FieldSet>

          <FieldSet legend="תולדות חיים">
            <RichTextEditor name="bio_he" label="תיאור (עברית)" defaultValue={author?.bio_he} />
            <RichTextEditor name="bio_en" label="Biography" defaultValue={author?.bio_en} />
            <AuthorTimelineField
              name="timeline"
              label="ציר תולדות חיים"
              defaultValue={author?.timeline}
              hint="שנה ומשפט קצר לכל תחנה — מוצג בעמוד הספר כציר זמן אופקי. אפשר להשאיר ריק."
            />
          </FieldSet>

          <FieldSet legend="פרסום">
            <CheckboxField
              name="is_published"
              label="מפורסם באתר"
              defaultChecked={author?.is_published ?? true}
            />
            <TextField
              name="sort_order"
              label="סדר תצוגה"
              type="number"
              dir="ltr"
              defaultValue={author?.sort_order ?? 0}
            />
          </FieldSet>
        </>
      )}
    </EntityForm>
  );
}
