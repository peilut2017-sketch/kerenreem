'use client';

import { useId, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isProjectStorageUrl, toCdnUrl } from '@/lib/image-src';

export type StorageBucket = 'covers' | 'events' | 'portraits' | 'samples' | 'site';

/**
 * אין מגבלת גודל בקוד.
 *
 * הכריכה נשמרת במלוא הרזולוציה שהועלתה, והתצוגה היא שמקטינה: next/image
 * מייצר גרסאות בגודל המתאים לכל מסך לפי sizes, כך שכרטיס בקטלוג מוריד
 * תמונה ברוחב מאתיים ומשהו פיקסלים ולא את הקובץ המקורי. המגבלה היחידה
 * שנשארה היא זו שמוגדרת ב-Supabase Storage עצמו.
 */

/** שם קובץ בטוח וייחודי — שמות עבריים או עם רווחים שוברים כתובות אחסון. */
function safeName(original: string): string {
  const extension = original.includes('.') ? original.split('.').pop()!.toLowerCase() : 'bin';
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${random}.${extension.replace(/[^a-z0-9]/g, '')}`;
}

/**
 * pathPrefix אופציונלי — לנכסים שנוצרים בקבוצה ושייכים לישות אחת
 * (דפי דוגמה של ספר, למשל), כדי שיישבו יחד תחת תיקייה ולא יתפזרו בשורש
 * ה-bucket. שם הקובץ עצמו נשאר אקראי גם אז, כדי שיצירה מחדש לא תדרוס
 * קובץ שעדיין מוגש מהמטמון.
 */
export async function uploadToBucket(
  bucket: StorageBucket,
  file: File,
  pathPrefix?: string,
): Promise<string> {
  const supabase = createClient();
  if (!supabase) throw new Error('אין חיבור לאחסון');

  const path = pathPrefix ? `${pathPrefix.replace(/\/+$/, '')}/${safeName(file.name)}` : safeName(file.name);
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw new Error(`ההעלאה נכשלה: ${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return toCdnUrl(data.publicUrl);
}

/**
 * שדה תמונה: העלאה ל-Supabase Storage, או הדבקת כתובת ידנית.
 * הערך הנשמר במסד הוא תמיד כתובת — כך אפשר להחליף ספק אחסון בעתיד
 * בלי לגעת בסכימה.
 */
export function ImageField({
  name,
  label,
  bucket,
  defaultValue,
  hint,
  accept = 'image/*',
}: {
  name: string;
  label: string;
  bucket: StorageBucket;
  defaultValue?: string | null;
  hint?: string;
  accept?: string;
}) {
  const id = useId();
  const [url, setUrl] = useState(defaultValue ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * כתובת חיצונית תישמר, אבל לא תוצג באתר: מדיניות ה-CSP מתירה תמונות
   * מאחסון הפרויקט בלבד. עדיף לומר את זה כאן, בזמן ההזנה, מאשר להשאיר
   * את העורך לגלות ריבוע ריק בעמוד החי — הוא לא יידע למה.
   */
  const foreignUrl = url.trim() !== '' && !isProjectStorageUrl(url.trim());

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      setUrl(await uploadToBucket(bucket, file));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'ההעלאה נכשלה');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  return (
    <div>
      <label htmlFor={`${id}-url`} className="field-label">
        {label}
      </label>

      <div className="flex flex-wrap items-start gap-4">
        {url && accept.startsWith('image') ? (
          // eslint-disable-next-line @next/next/no-img-element -- תצוגה מקדימה של קובץ שהרגע הועלה
          <img
            src={toCdnUrl(url)}
            alt=""
            className="h-24 w-auto max-w-24 border border-rule object-contain"
          />
        ) : null}

        <div className="min-w-56 flex-1 space-y-2">
          <input
            id={`${id}-url`}
            name={name}
            type="url"
            dir="ltr"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
            aria-invalid={error ? true : undefined}
            className="field-input"
          />

          <div className="flex items-center gap-3">
            <input
              id={`${id}-file`}
              type="file"
              accept={accept}
              onChange={onFile}
              disabled={busy}
              aria-label={`העלאת קובץ — ${label}`}
              className="text-caption file:me-3 file:border file:border-rule-strong file:bg-cream-2 file:px-3 file:py-1.5 file:text-caption"
            />
            {busy ? (
              <span role="status" className="text-caption text-muted">
                מעלה…
              </span>
            ) : null}
            {url ? (
              <button
                type="button"
                onClick={() => setUrl('')}
                className="text-caption text-muted underline underline-offset-4 hover:text-burgundy"
              >
                הסרה
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <span id={`${id}-error`} className="field-error">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="field-hint">
          {hint}
        </span>
      ) : null}

      {foreignUrl ? (
        <span role="status" className="field-error">
          הכתובת אינה מאחסון האתר, ולכן התמונה לא תוצג בעמוד הציבורי. יש להעלות
          את הקובץ בכפתור ההעלאה שלמעלה.
        </span>
      ) : null}
    </div>
  );
}
