'use client';

import { useState, useTransition } from 'react';
import { Img as Image } from '@/components/Img';
import { uploadToBucket } from './ImageField';
import { AdminIcon } from './AdminIcons';
import { Spinner } from './SubmitButton';
import { saveBookImages } from '@/lib/admin/actions';
import type { BookImage } from '@/lib/supabase/types';

interface Row {
  key: number;
  image_url: string;
  alt: string;
  caption_he: string;
}

let nextKey = 0;
function makeRow(image?: Pick<BookImage, 'image_url' | 'alt' | 'caption_he'>): Row {
  nextKey += 1;
  return {
    key: nextKey,
    image_url: image?.image_url ?? '',
    alt: image?.alt ?? '',
    caption_he: image?.caption_he ?? '',
  };
}

/**
 * מונע ש-Enter בשדה טקסט כאן ישלח בטעות את טופס הספר החיצוני.
 *
 * העורך הזה יושב היום בתוך לשונית "תמונות" של טופס הספר, שכולה בתוך אותו
 * <form> יחיד (ראו EntityForm.tsx) — כך שכל שדה טקסט כאן נמצא, מבחינת
 * הדפדפן, בתוך טופס הספר. בלי החסימה הזו, Enter בשדה "טקסט חלופי" היה
 * מפעיל שליחה מלאה של טופס הספר, לא רק את השמירה הנפרדת של הגלריה
 * (saveBookImages) שאותה מבצע הכפתור למטה.
 */
function guardEnterSubmit(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') {
    event.preventDefault();
  }
}

/**
 * גלריית התמונות הנוספות של הספר — נפרדת מטופס הספר עצמו ונשמרת
 * בפעולת שרת משלה, כי book_images היא טבלה נפרדת ולא שדה על הספר
 * (ראו saveBookImages ב-actions.ts).
 */
export function BookImagesEditor({ bookId, images }: { bookId: string; images: BookImage[] }) {
  const [rows, setRows] = useState<Row[]>(() => images.map((image) => makeRow(image)));
  const [uploadingKey, setUploadingKey] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  function update(key: number, patch: Partial<Row>) {
    setStatus('idle');
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  async function handleUpload(key: number, file: File) {
    setUploadingKey(key);
    setError(null);
    try {
      const url = await uploadToBucket('covers', file);
      update(key, { image_url: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploadingKey(null);
    }
  }

  function save() {
    startTransition(async () => {
      setStatus('idle');
      setError(null);
      const result = await saveBookImages(
        bookId,
        rows.map(({ image_url, alt, caption_he }) => ({ image_url, alt, caption_he })),
      );
      if (result?.error) {
        setError(result.error);
        setStatus('error');
      } else {
        setStatus('saved');
      }
    });
  }

  return (
    <div onKeyDown={guardEnterSubmit}>
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.key} className="admin-card grid gap-4 p-4 sm:grid-cols-[8rem_1fr]">
            <div>
              <div className="relative aspect-3/4 w-full overflow-hidden rounded-[var(--admin-radius-btn)] bg-cream-2">
                {row.image_url ? (
                  <Image src={row.image_url} alt="" fill sizes="128px" className="object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-muted">
                    <AdminIcon name="image" className="h-6 w-6" />
                  </span>
                )}
              </div>
              <label className="mt-2 block">
                <span className="sr-only">העלאת תמונה</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingKey === row.key}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleUpload(row.key, file);
                  }}
                  className="text-caption file:me-3 file:rounded-[var(--admin-radius-btn)] file:border-0 file:bg-cream-2 file:px-3 file:py-1.5 file:text-caption"
                />
              </label>
              {uploadingKey === row.key ? (
                <span className="mt-1 inline-flex items-center gap-1.5 text-caption text-muted">
                  <Spinner className="h-3 w-3" /> מעלה…
                </span>
              ) : null}
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="admin-field-label">טקסט חלופי</span>
                <input
                  value={row.alt}
                  onChange={(event) => update(row.key, { alt: event.target.value })}
                  className="admin-field-input mt-1"
                />
              </label>
              <label className="block">
                <span className="admin-field-label">כיתוב</span>
                <input
                  value={row.caption_he}
                  onChange={(event) => update(row.key, { caption_he: event.target.value })}
                  className="admin-field-input mt-1"
                />
              </label>
              <button
                type="button"
                onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                className="admin-btn admin-btn-ghost admin-btn-icon"
                aria-label="הסרת התמונה"
                title="הסרת התמונה"
              >
                <AdminIcon name="trash" className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRows((current) => [...current, makeRow()])}
        className="admin-btn admin-btn-quiet mt-4"
      >
        <AdminIcon name="plus" className="h-4 w-4" />
        הוספת תמונה
      </button>

      <div className="mt-5 flex items-center gap-3 border-t border-rule pt-5">
        <button type="button" onClick={save} disabled={pending} className="admin-btn admin-btn-solid">
          {pending ? <Spinner className="h-3.5 w-3.5" /> : <AdminIcon name="check" className="h-4 w-4" />}
          {pending ? 'שומר…' : 'שמירת הגלריה'}
        </button>
        {status === 'saved' ? (
          <span className="admin-badge admin-badge-success">
            <span className="admin-badge-dot" aria-hidden="true" />
            נשמר
          </span>
        ) : null}
        {error ? (
          <span role="alert" className="text-small text-[var(--admin-danger)]">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
