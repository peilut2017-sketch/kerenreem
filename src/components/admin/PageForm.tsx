'use client';

import { EntityForm } from './EntityForm';
import { CheckboxField, FieldSet, TextField } from './Fields';
import { RichTextEditor } from './RichTextEditor';
import type { ContentPage } from '@/lib/supabase/types';

/** עמודים שהאתר מצפה למצוא לפי slug — שינוי המזהה שלהם ינתק את העמוד. */
const RESERVED: Record<string, string> = {
  home: 'משפט הפתיחה בעמוד הבית',
  about: 'עמוד אודות',
  donate: 'טקסט משלים בעמוד התרומה',
  terms: 'תקנון ותנאי שימוש — עמוד חובה',
  privacy: 'מדיניות פרטיות — עמוד חובה',
  accessibility: 'הצהרת נגישות — עמוד חובה',
};

export function PageForm({ page, canWrite }: { page: ContentPage | null; canWrite: boolean }) {
  const reserved = page ? RESERVED[page.slug] : undefined;

  return (
    <EntityForm entity="pages" id={page?.id ?? null} canWrite={canWrite} backHref="/admin/pages">
      {(errors) => (
        <>
          {reserved ? (
            <p className="border-s-2 border-burgundy bg-cream-2 px-4 py-3 text-small text-ink-soft">
              {reserved}. שינוי מזהה הכתובת ינתק את העמוד מהאתר.
            </p>
          ) : null}

          <FieldSet legend="זיהוי">
            <TextField
              name="title_he"
              label="כותרת (עברית)"
              required
              defaultValue={page?.title_he}
              error={errors.title_he}
            />
            <TextField
              name="slug"
              label="מזהה כתובת"
              required
              dir="ltr"
              defaultValue={page?.slug}
              error={errors.slug}
            />
            <TextField name="title_en" label="Title" dir="ltr" defaultValue={page?.title_en} />
          </FieldSet>

          <FieldSet legend="תוכן">
            <RichTextEditor name="body_he" label="גוף העמוד (עברית)" defaultValue={page?.body_he} />
            <RichTextEditor name="body_en" label="Body" defaultValue={page?.body_en} />
          </FieldSet>

          <FieldSet legend="פרסום">
            <CheckboxField
              name="is_published"
              label="מפורסם באתר"
              defaultChecked={page?.is_published ?? true}
              hint="בעמודי החובה (תקנון, פרטיות, נגישות) יש להשאיר מפורסם."
            />
          </FieldSet>
        </>
      )}
    </EntityForm>
  );
}
