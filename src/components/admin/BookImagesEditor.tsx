'use client';

import { useState, useTransition } from 'react';
import { Img as Image } from '@/components/Img';
import { uploadToBucket } from './ImageField';
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
    <div>
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.key} className="grid gap-4 border border-rule p-4 sm:grid-cols-[8rem_1fr]">
            <div>
              <div className="relative aspect-3/4 w-full overflow-hidden rounded-[var(--radius-sm)] bg-cream-2">
                {row.image_url ? (
                  <Image src={row.image_url} alt="" fill sizes="128px" className="object-cover" />
                ) : null}
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
                  className="text-caption"
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
                <span className="field-label">טקסט חלופי</span>
                <input
                  value={row.alt}
                  onChange={(event) => update(row.key, { alt: event.target.value })}
                  className="field-input mt-1"
                />
              </label>
              <label className="block">
                <span className="field-label">כיתוב</span>
                <input
                  value={row.caption_he}
                  onChange={(event) => update(row.key, { caption_he: event.target.value })}
                  className="field-input mt-1"
                />
              </label>
              <button
                type="button"
                onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                className="text-caption text-burgundy underline underline-offset-4"
              >
                הסרת התמונה
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRows((current) => [...current, makeRow()])}
        className="btn btn-quiet mt-4"
      >
        + הוספת תמונה
      </button>

      <div className="mt-5 flex items-center gap-3 border-t border-rule pt-5">
        <button type="button" onClick={save} disabled={pending} className="btn btn-solid">
          {pending ? 'שומר…' : 'שמירת הגלריה'}
        </button>
        {status === 'saved' ? <span className="text-small text-ink-soft">נשמר.</span> : null}
        {error ? (
          <span role="alert" className="text-small text-burgundy">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
