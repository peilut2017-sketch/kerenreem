'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CONTACT_ATTACHMENTS_ACCEPT,
  MAX_ATTACHMENTS,
  uploadContactAttachment,
  validateAttachment,
} from '@/lib/contact-upload';
import { FileDropZone } from '@/components/FileDropZone';
import type { ContactAttachment } from '@/lib/supabase/types';

/**
 * צירוף קבצים לטופס יצירת הקשר.
 *
 * מעלה מיד עם הבחירה (כמו GalleryField בניהול), לא בשליחת הטופס: כך
 * המבקר רואה מייד אם קובץ נדחה (גודל/סוג) בלי לחכות לשליחה. הקבצים
 * שכבר הועלו נשלחים כ-JSON בשדה מוסתר, בדיוק כמו גלריית תמונות באירוע.
 */
export function ContactAttachmentsField({ name }: { name: string }) {
  const t = useTranslations('contact');
  const id = useId();
  const [files, setFiles] = useState<ContactAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function ingest(selected: File[]) {
    if (selected.length === 0) return;

    const nextErrors: string[] = [];
    const roomLeft = MAX_ATTACHMENTS - files.length;
    const overflow = selected.length > roomLeft;
    const toUpload = selected.slice(0, Math.max(roomLeft, 0));
    if (overflow) nextErrors.push(t('attachmentsTooMany'));

    const valid: File[] = [];
    for (const file of toUpload) {
      const problem = validateAttachment(
        file,
        t('attachmentsTooLarge', { name: file.name }),
        t('attachmentsBadType', { name: file.name }),
      );
      if (problem) nextErrors.push(problem);
      else valid.push(file);
    }

    setBusy(true);
    setErrors(nextErrors);
    try {
      const uploaded = await Promise.all(
        valid.map(async (file) => {
          try {
            return await uploadContactAttachment(file);
          } catch (uploadError) {
            const message = uploadError instanceof Error ? uploadError.message : String(uploadError);
            setErrors((current) => [...current, t('attachmentsUploadFailed', { name: file.name, error: message })]);
            return null;
          }
        }),
      );
      setFiles((current) => [...current, ...uploaded.filter((item): item is ContactAttachment => item !== null)]);
    } finally {
      setBusy(false);
    }
  }

  function onFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = '';
    void ingest(selected);
  }

  const remove = (path: string) => setFiles((current) => current.filter((file) => file.path !== path));

  const full = files.length >= MAX_ATTACHMENTS;

  return (
    <FileDropZone
      onFiles={(dropped) => void ingest(dropped)}
      accept={CONTACT_ATTACHMENTS_ACCEPT}
      multiple
      disabled={busy || full}
      rootClassName="relative rounded-[var(--radius-md)]"
      activeClassName="outline outline-2 outline-dashed outline-offset-4 outline-gold-deep"
      overlayClassName="absolute inset-0 z-10 grid place-items-center rounded-[var(--radius-md)] bg-cream-2/90 text-small font-semibold text-ink"
      hint={t('attachmentsDropHint')}
    >
      <label htmlFor={`${id}-files`} className="field-label">
        {t('attachments')}
      </label>
      <span id={`${id}-hint`} className="field-hint mb-2 block">
        {t('attachmentsHint')}
      </span>

      <input
        id={`${id}-files`}
        type="file"
        accept={CONTACT_ATTACHMENTS_ACCEPT}
        multiple
        onChange={onFiles}
        disabled={busy || full}
        aria-describedby={`${id}-hint`}
        className="text-caption file:me-3 file:border file:border-rule-strong file:bg-cream-2 file:px-3 file:py-1.5 file:text-caption"
      />
      {busy ? (
        <span role="status" className="ms-3 text-caption text-muted">
          {t('attachmentsUploading')}
        </span>
      ) : full ? null : (
        <span className="ms-3 text-caption text-muted">{t('attachmentsDropHint')}</span>
      )}

      {errors.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {errors.map((message, index) => (
            <li key={index} role="alert" className="field-error">
              {message}
            </li>
          ))}
        </ul>
      ) : null}

      {files.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {files.map((file) => (
            <li
              key={file.path}
              className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-rule bg-cream-2/60 px-3 py-1.5 text-caption text-ink-soft"
            >
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-muted">{Math.round(file.size / 1024)}KB</span>
              <button
                type="button"
                onClick={() => remove(file.path)}
                className="shrink-0 text-burgundy underline underline-offset-4"
              >
                {t('attachmentsRemove')}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <input type="hidden" name={name} value={JSON.stringify(files)} />
    </FileDropZone>
  );
}
