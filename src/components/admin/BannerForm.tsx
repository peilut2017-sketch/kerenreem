'use client';

import { EntityForm } from './EntityForm';
import { CheckboxField, FieldSet, SelectField, TextAreaField, TextField } from './Fields';
import { ImageField } from './ImageField';
import type { Banner } from '@/lib/supabase/types';

const FOCAL_OPTIONS = [
  { value: 'center', label: 'מרכז' },
  { value: 'top', label: 'למעלה' },
  { value: 'bottom', label: 'למטה' },
  { value: 'start', label: 'צד ימין' },
  { value: 'end', label: 'צד שמאל' },
];

/** timestamptz מהמסד → הפורמט ש-<input type="datetime-local"> מצפה לו. */
function toLocalInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function BannerForm({ banner, canWrite }: { banner: Banner | null; canWrite: boolean }) {
  return (
    <EntityForm entity="banners" id={banner?.id ?? null} canWrite={canWrite} backHref="/admin/banners">
      {(errors) => (
        <>
          <FieldSet legend="תוכן">
            <TextField
              name="title_he"
              label="כותרת"
              required
              defaultValue={banner?.title_he}
              error={errors.title_he}
              hint="שורה קצרה. הכותרת מוצגת גדולה מעל התמונה."
            />
            <TextAreaField
              name="subtitle_he"
              label="שורת משנה"
              rows={2}
              defaultValue={banner?.subtitle_he}
              hint="משפט אחד. אפשר להשאיר ריק."
            />
          </FieldSet>

          <FieldSet
            legend="תמונות"
            description="שולחני: 2400×1000 (יחס 12:5), מינימום 1920×800. נייד: 1080×1350 (יחס 4:5). JPEG או WebP, עד 400KB. הקרוסלה מכהה את התמונה ומניחה עליה טקסט לבן — עדיף צילום שמרכזו אינו עמוס."
          >
            <ImageField
              name="image_url"
              label="תמונה למסך מחשב"
              bucket="site"
              defaultValue={banner?.image_url}
            />
            <ImageField
              name="image_mobile_url"
              label="תמונה לנייד (רשות)"
              bucket="site"
              defaultValue={banner?.image_mobile_url}
              hint="אם לא תועלה, תוצג התמונה הרחבה בחיתוך לפי נקודת המיקוד שלמטה."
            />
            <SelectField
              name="focal_point"
              label="נקודת מיקוד בחיתוך"
              defaultValue={banner?.focal_point ?? 'center'}
              options={FOCAL_OPTIONS}
              hint="קובע איזה חלק מהתמונה הרחבה יישאר גלוי במסך צר."
            />
          </FieldSet>

          <FieldSet legend="קישור">
            <TextField
              name="link_url"
              label="יעד הלחיצה"
              dir="ltr"
              defaultValue={banner?.link_url}
              hint="נתיב פנימי כמו /books/pnei-hamoadim, או כתובת מלאה החל ב-https://. ריק = הבאנר אינו לחיץ."
            />
            <TextField
              name="cta_label_he"
              label="טקסט הכפתור"
              defaultValue={banner?.cta_label_he}
              hint="למשל: לפרטים על הספר. ריק = לא יוצג כפתור."
            />
          </FieldSet>

          <FieldSet legend="אנגלית" description="אפשר להשאיר ריק — יוצג הנוסח העברי.">
            <TextField name="title_en" label="Title" dir="ltr" defaultValue={banner?.title_en} />
            <TextField name="subtitle_en" label="Subtitle" dir="ltr" defaultValue={banner?.subtitle_en} />
            <TextField name="cta_label_en" label="Button label" dir="ltr" defaultValue={banner?.cta_label_en} />
          </FieldSet>

          <FieldSet legend="תצוגה">
            <CheckboxField
              name="is_published"
              label="מוצג באתר"
              defaultChecked={banner?.is_published ?? false}
            />
            <TextField
              name="sort_order"
              label="סדר בקרוסלה"
              type="number"
              dir="ltr"
              defaultValue={banner?.sort_order ?? 0}
              hint="מספר נמוך מופיע קודם."
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                name="starts_at"
                label="מוצג החל מ־ (רשות)"
                type="date"
                dir="ltr"
                defaultValue={toLocalInput(banner?.starts_at).slice(0, 10)}
              />
              <TextField
                name="ends_at"
                label="מוסתר החל מ־ (רשות)"
                type="date"
                dir="ltr"
                defaultValue={toLocalInput(banner?.ends_at).slice(0, 10)}
                hint="שימושי לבאנר של אירוע — הוא ייכבה מעצמו אחרי המועד."
              />
            </div>
          </FieldSet>
        </>
      )}
    </EntityForm>
  );
}
