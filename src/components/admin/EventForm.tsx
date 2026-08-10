'use client';

import { EntityForm } from './EntityForm';
import { ToggleField, FieldSet, TextField } from './Fields';
import { ImageField } from './ImageField';
import { GalleryField } from './GalleryField';
import { RichTextEditor } from './RichTextEditor';
import type { EventRecord } from '@/lib/supabase/types';

export function EventForm({ event, canWrite }: { event: EventRecord | null; canWrite: boolean }) {
  return (
    <EntityForm entity="events" id={event?.id ?? null} canWrite={canWrite} backHref="/admin/events">
      {(errors) => (
        <>
          <FieldSet legend="זיהוי">
            <TextField
              name="title_he"
              label="שם האירוע (עברית)"
              required
              defaultValue={event?.title_he}
              error={errors.title_he}
            />
            <TextField
              name="slug"
              label="מזהה כתובת"
              required
              dir="auto"
              defaultValue={event?.slug}
              error={errors.slug}
              hint="אותיות לטיניות קטנות או עבריות, ספרות ומקפים."
            />
            <TextField name="title_en" label="Title" dir="ltr" defaultValue={event?.title_en} />
          </FieldSet>

          <FieldSet
            legend="תאריך"
            description="התאריך הלועזי הוא מקור האמת — לפיו האתר ממיין ומחשב את התאריך העברי אוטומטית. שדה התאריך העברי נועד לאירוע שנתי חוזר (למשל ט״ו באב), שבו התאריך העברי קבוע והלועזי משתנה משנה לשנה."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                name="event_date"
                label="תאריך לועזי"
                type="date"
                dir="ltr"
                defaultValue={event?.event_date ?? ''}
              />
              <TextField
                name="event_date_he"
                label="תאריך עברי קבוע (רשות)"
                placeholder="ט״ו באב"
                defaultValue={event?.event_date_he}
              />
            </div>
          </FieldSet>

          <FieldSet
            legend="תקציר האירוע"
            description="מוצג ליד תמונת ה-Hero, לפני תחילת רצף הסיפור למטה (נערך במסך נפרד אחרי השמירה הראשונה). כמה משפטים — לא כל מה שקרה באירוע."
          >
            <RichTextEditor name="body_he" label="תקציר (עברית)" defaultValue={event?.body_he} />
            <RichTextEditor name="body_en" label="Summary" defaultValue={event?.body_en} />
          </FieldSet>

          <FieldSet legend="מדיה ראשית">
            <ImageField
              name="cover_image_url"
              label="תמונת Hero"
              bucket="events"
              defaultValue={event?.cover_image_url}
              hint="הרקע שמאחורי כותרת האירוע. צבעי התמונה קובעים את גוון הרקע."
            />
            <TextField
              name="featured_video_url"
              label="סרטון ראשי (רשות)"
              type="url"
              dir="ltr"
              defaultValue={event?.featured_video_url}
              hint="כתובת YouTube או Vimeo. אם יש גם וידאו ברצף הסיפור למטה, זה נוסף עליו ולא מחליף אותו."
            />
            <GalleryField
              name="gallery"
              label="גלריה מסיימת"
              defaultValue={event?.gallery}
              hint="תמונות שלא שובצו ידנית לתוך רצף הסיפור — מוצגות בהדרגה בסוף העמוד."
            />
          </FieldSet>

          <FieldSet legend="פרסום">
            {/* אירוע חדש נפתח כמפורסם, כמו פעילות או מחבר.
                קודם לכן הוא נפתח כטיוטה בשקט, ואז אירוע שנוסף פשוט לא הופיע
                באתר — ומי שפתח את הכתובת שלו קיבל עמוד "לא נמצא", כי גם
                הרשימה וגם עמוד האירוע מסננים is_published. ספר נשאר טיוטה
                כברירת מחדל כי יש בו עשרות שדות למלא; אירוע הוא כותרת,
                תאריך וטקסט. */}
            <ToggleField
              name="is_published"
              label="מפורסם באתר"
              defaultChecked={event?.is_published ?? true}
              hint="אירוע שאינו מפורסם נראה בממשק הניהול בלבד, וכתובתו באתר מחזירה עמוד ״לא נמצא״."
              entityKey="events"
              id={event?.id}
            />
          </FieldSet>
        </>
      )}
    </EntityForm>
  );
}
