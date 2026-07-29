'use client';

import { useId, useState } from 'react';
import { uploadToBucket } from './ImageField';
import type { GalleryImage } from '@/lib/supabase/types';

/**
 * גלריית תמונות לאירוע. נשמרת כ-jsonb במסד (מערך של {url, caption_he,
 * caption_en}) ולכן אינה דורשת טבלה נפרדת.
 *
 * הכיתוב אינו רשות בפועל: הוא משמש כטקסט חלופי לתמונה. בלעדיו התמונה
 * מקבלת תיאור גנרי, וזו נגישות פחותה.
 */
export function GalleryField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: GalleryImage[] | null;
}) {
  const id = useId();
  const [images, setImages] = useState<GalleryImage[]>(defaultValue ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setBusy(true);
    setError(null);
    try {
      const uploaded = await Promise.all(
        files.map(async (file) => ({ url: await uploadToBucket('events', file), caption_he: '' })),
      );
      setImages((current) => [...current, ...uploaded]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'ההעלאה נכשלה');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  const update = (index: number, patch: Partial<GalleryImage>) =>
    setImages((current) => current.map((image, i) => (i === index ? { ...image, ...patch } : image)));

  const remove = (index: number) =>
    setImages((current) => current.filter((_, i) => i !== index));

  const move = (index: number, delta: number) =>
    setImages((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  return (
    <div>
      <span className="field-label">{label}</span>

      <input
        id={`${id}-files`}
        type="file"
        accept="image/*"
        multiple
        onChange={onFiles}
        disabled={busy}
        aria-label={`הוספת תמונות — ${label}`}
        className="text-caption file:me-3 file:border file:border-rule-strong file:bg-paper-2 file:px-3 file:py-1.5 file:text-caption"
      />
      {busy ? (
        <span role="status" className="ms-3 text-caption text-muted">
          מעלה…
        </span>
      ) : null}
      {error ? (
        <span role="alert" className="field-error">
          {error}
        </span>
      ) : null}

      {images.length > 0 ? (
        <ul className="mt-4 space-y-3 border-t border-rule pt-4">
          {images.map((image, index) => (
            <li key={`${image.url}-${index}`} className="flex flex-wrap items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- תצוגה מקדימה בממשק הניהול */}
              <img src={image.url} alt="" className="h-20 w-20 border border-rule object-cover" />

              <div className="min-w-56 flex-1">
                <label htmlFor={`${id}-caption-${index}`} className="field-label">
                  כיתוב (משמש גם כטקסט חלופי)
                </label>
                <input
                  id={`${id}-caption-${index}`}
                  type="text"
                  value={image.caption_he ?? ''}
                  onChange={(event) => update(index, { caption_he: event.target.value })}
                  className="field-input"
                />
              </div>

              <div className="flex items-center gap-3 pt-7 text-caption">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="underline underline-offset-4 disabled:opacity-40"
                >
                  הקדמה
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === images.length - 1}
                  className="underline underline-offset-4 disabled:opacity-40"
                >
                  איחור
                </button>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-burgundy underline underline-offset-4"
                >
                  הסרה
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <input type="hidden" name={name} value={JSON.stringify(images)} />
    </div>
  );
}
