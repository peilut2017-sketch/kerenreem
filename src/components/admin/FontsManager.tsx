'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createCustomFont, deleteCustomFont, toggleCustomFont } from '@/lib/admin/fonts-actions';
import { uploadToBucket } from './ImageField';
import { Spinner } from './SubmitButton';
import type { CustomFont } from '@/lib/supabase/types';

/**
 * [1.11] התקנת גופנים לאתר: העלאת קובץ (woff2 מומלץ), שם תצוגה,
 * והפעלה/כיבוי. גופן פעיל מוזרק לאתר ולממשק הניהול (CustomFontsStyle)
 * וזמין מיד בבורר הגופנים של עורכי הטקסט העשיר.
 */
export function FontsManager({ fonts }: { fonts: CustomFont[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function install() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('יש לבחור קובץ גופן');
      return;
    }
    if (!name.trim()) {
      setError('יש להזין שם לגופן');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const url = await uploadToBucket('site', file, 'fonts');
      startTransition(async () => {
        const result = await createCustomFont(name, url);
        if (result?.error) setError(result.error);
        else {
          setName('');
          if (fileRef.current) fileRef.current.value = '';
        }
        router.refresh();
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : String(uploadError));
    } finally {
      setUploading(false);
    }
  }

  function run(action: () => Promise<{ error?: string } | undefined>) {
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (result?.error) setError(result.error);
      router.refresh();
    });
  }

  return (
    <section className="admin-card space-y-5 px-5 py-5">
      <div>
        <h2 className="font-serif text-h3 text-ink">גופנים מותקנים</h2>
        <p className="mt-1 text-caption text-muted">
          גופן שמותקן כאן זמין מיד בבורר הגופנים של עורכי הטקסט באתר, והתוכן שנשמר איתו מוצג
          בו גם בעמודים הציבוריים. מומלץ קובץ WOFF2 (קטן ומהיר). ודאו שרישיון הגופן מתיר
          שימוש באתר.
        </p>
      </div>

      {fonts.length > 0 ? (
        <ul className="divide-y divide-rule">
          {fonts.map((font) => (
            <li key={font.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{font.name}</span>
                <span className="block truncate text-caption text-muted" dir="ltr">
                  var(--font-custom-{font.slug})
                </span>
              </span>
              <span className={`admin-badge ${font.is_active ? 'admin-badge-success' : 'admin-badge-neutral'}`}>
                {font.is_active ? 'פעיל' : 'כבוי'}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => toggleCustomFont(font.id, !font.is_active))}
                className="admin-btn admin-btn-quiet"
              >
                {font.is_active ? 'כיבוי' : 'הפעלה'}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (window.confirm(`להסיר את הגופן "${font.name}"? תוכן שנשמר איתו יוצג בגופן ברירת המחדל.`)) {
                    run(() => deleteCustomFont(font.id));
                  }
                }}
                className="admin-btn admin-btn-danger"
              >
                הסרה
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-small text-muted">טרם הותקנו גופנים.</p>
      )}

      <div className="flex flex-wrap items-end gap-3 border-t border-rule pt-4">
        <div>
          <label htmlFor="font-name" className="admin-field-label">
            שם הגופן
          </label>
          <input
            id="font-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="למשל: קורן חדש"
            className="admin-field-input w-52"
          />
        </div>
        <div>
          <label htmlFor="font-file" className="admin-field-label">
            קובץ הגופן
          </label>
          <input
            id="font-file"
            ref={fileRef}
            type="file"
            accept=".woff2,.woff,.ttf,.otf"
            className="admin-field-input w-64"
          />
        </div>
        <button
          type="button"
          disabled={pending || uploading}
          onClick={install}
          className="admin-btn admin-btn-solid"
        >
          {pending || uploading ? <Spinner className="h-3.5 w-3.5" /> : null}
          התקנת גופן
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-small text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
