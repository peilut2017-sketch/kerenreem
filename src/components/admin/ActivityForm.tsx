'use client';

import { EntityForm } from './EntityForm';
import { CheckboxField, FieldSet, TextAreaField, TextField } from './Fields';
import { ImageField } from './ImageField';
import { RichTextEditor } from './RichTextEditor';
import type { Activity } from '@/lib/supabase/types';

export function ActivityForm({
  activity,
  canWrite,
}: {
  activity: Activity | null;
  canWrite: boolean;
}) {
  return (
    <EntityForm
      entity="activities"
      id={activity?.id ?? null}
      canWrite={canWrite}
      backHref="/admin/activities"
    >
      {(errors) => (
        <>
          <FieldSet legend="זיהוי">
            <TextField
              name="title_he"
              label="שם הציר (עברית)"
              required
              defaultValue={activity?.title_he}
              error={errors.title_he}
            />
            <TextField
              name="slug"
              label="מזהה כתובת"
              required
              dir="auto"
              defaultValue={activity?.slug}
              error={errors.slug}
              hint="אותיות לטיניות קטנות או עבריות, ספרות ומקפים."
            />
            <TextField name="title_en" label="Title" dir="ltr" defaultValue={activity?.title_en} />
          </FieldSet>

          <FieldSet
            legend="תקציר"
            description="מופיע בעמוד הבית וברשימת הפעילות. שתיים־שלוש שורות."
          >
            <TextAreaField name="summary_he" label="תקציר (עברית)" rows={3} defaultValue={activity?.summary_he} />
            <TextAreaField name="summary_en" label="Summary" rows={3} defaultValue={activity?.summary_en} />
          </FieldSet>

          <FieldSet legend="תוכן">
            <RichTextEditor name="body_he" label="גוף העמוד (עברית)" defaultValue={activity?.body_he} />
            <RichTextEditor name="body_en" label="Body" defaultValue={activity?.body_en} />
          </FieldSet>

          <FieldSet legend="מדיה">
            <ImageField
              name="cover_image_url"
              label="תמונה"
              bucket="site"
              defaultValue={activity?.cover_image_url}
            />
            <TextField
              name="icon"
              label="מזהה אייקון (רשות)"
              dir="ltr"
              defaultValue={activity?.icon}
              hint="נשמר לשימוש עתידי. עיצוב האתר מציג את הצירים בטיפוגרפיה ולא באייקונים."
            />
          </FieldSet>

          <FieldSet legend="פרסום">
            <CheckboxField
              name="is_published"
              label="מפורסם באתר"
              defaultChecked={activity?.is_published ?? true}
            />
            <TextField
              name="sort_order"
              label="סדר תצוגה"
              type="number"
              dir="ltr"
              defaultValue={activity?.sort_order ?? 0}
            />
          </FieldSet>
        </>
      )}
    </EntityForm>
  );
}
