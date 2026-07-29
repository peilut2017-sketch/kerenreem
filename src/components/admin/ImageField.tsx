'use client';

import { useId, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type StorageBucket = 'covers' | 'events' | 'portraits' | 'samples' | 'site';

const MAX_BYTES = 8 * 1024 * 1024;

/** שם קובץ בטוח וייחודי — שמות עבריים או עם רווחים שוברים כתובות אחסון. */
function safeName(original: string): string {
  const extension = original.includes('.') ? original.split('.').pop()!.toLowerCase() : 'bin';
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${random}.${extension.replace(/[^a-z0-9]/g, '')}`;
}

export async function uploadToBucket(bucket: StorageBucket, file: File): Promise<string> {
  const supabase = createClient();
  if (!supabase) throw new Error('אין חיבור לאחסון');

  if (file.size > MAX_BYTES) {
    throw new Error('הקובץ גדול מ-8MB. יש לכווץ אותו לפני ההעלאה.');
  }

  const path = safeName(file.name);
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw new Error(`ההעלאה נכשלה: ${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
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
            src={url}
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
    </div>
  );
}
