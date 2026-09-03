'use client';

import { useId, useMemo, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AdminIcon } from './AdminIcons';
import { AdminCell, AdminRow, AdminTable } from './AdminList';
import type { StorageBucket } from './ImageField';
import { recordAdminStorageReplace } from '@/lib/admin/activity-audit-actions';
import { deleteStorageFile } from '@/lib/admin/media-library-actions';
import type { AdminStorageFile } from '@/lib/admin/queries';

import { formatAdminDate } from '@/lib/admin/reporting/format';
export interface MediaFileRow extends AdminStorageFile {
  publicUrl: string;
  viewCount: number | null;
}

const BUCKET_LABELS: Record<string, string> = {
  covers: 'כריכות',
  events: 'אירועים',
  portraits: 'דיוקנאות',
  samples: 'דפי דוגמה',
  site: 'כללי',
};

/**
 * הספרייה מרכזת את *כל* הקבצים שהועלו — לא רק תמונות: דפדופי דוגמה של
 * ספרים הם PDF (sample_pdf_url ב-BookForm), וגופנים מותקנים הם woff/ttf
 * (FontsManager, ב-bucket 'site'). תצוגה מקדימה של <img> על קבצים כאלה
 * הציגה אייקון תמונה שבורה. מסווגים לפי mime (ובסיומת, לקבצים ישנים
 * שהועלו בלי metadata) ומציגים תג מתאים במקום תמונה שבורה.
 */
type FileKind = 'image' | 'pdf' | 'font' | 'other';

function fileKind(file: AdminStorageFile): FileKind {
  const mime = file.mime_type ?? '';
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf' || /\.pdf$/i.test(file.path)) return 'pdf';
  if (mime.startsWith('font/') || /\.(woff2?|ttf|otf)$/i.test(file.path)) return 'font';
  if (!mime && /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(file.path)) return 'image';
  return 'other';
}

/** סוג הקובץ שכפתור ההחלפה מקבל — החלפה שומרת על אותו path, ולכן על אותו סוג. */
const REPLACE_ACCEPT: Record<FileKind, string> = {
  image: 'image/*',
  pdf: 'application/pdf',
  font: '.woff2,.woff,.ttf,.otf',
  other: '',
};

const KIND_BADGE: Record<Exclude<FileKind, 'image'>, string> = {
  pdf: 'PDF',
  font: 'Aa',
  other: '?',
};

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDateTime(value: string): string {
  return formatAdminDate(value, 'dateTime');
}

/**
 * [1.19] טבלת ספריית המדיה — סינון/חיפוש בצד הלקוח על רשימה שכבר
 * נטענה במלואה בשרת (admin_list_storage_files, ראו queries.ts): כמות
 * הקבצים הצפויה באתר הזה אינה מצדיקה pagination/שאילתות חוזרות לכל
 * הקלדה, כמו ברוב מסכי הרשימה האחרים בפרויקט.
 */
export function MediaLibraryTable({ files }: { files: MediaFileRow[] }) {
  const [query, setQuery] = useState('');
  const [bucket, setBucket] = useState('all');
  const [rows, setRows] = useState(files);

  const buckets = useMemo(() => Array.from(new Set(files.map((f) => f.bucket_id))), [files]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (bucket !== 'all' && row.bucket_id !== bucket) return false;
      if (q && !row.path.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, bucket]);

  const totals = useMemo(() => {
    const size = rows.reduce((sum, f) => sum + (f.size_bytes ?? 0), 0);
    return { count: rows.length, size };
  }, [rows]);

  function patchRow(id: string, patch: Partial<MediaFileRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <p className="text-caption text-muted">
          {totals.count.toLocaleString('he-IL')} קבצים · {formatBytes(totals.size)} סה&quot;כ
        </p>
        <div className="ms-auto flex flex-wrap items-center gap-2.5">
          <select
            value={bucket}
            onChange={(event) => setBucket(event.target.value)}
            aria-label="סינון לפי תיקייה"
            className="admin-field-input !w-auto"
          >
            <option value="all">כל התיקיות</option>
            {buckets.map((b) => (
              <option key={b} value={b}>
                {BUCKET_LABELS[b] ?? b}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חיפוש לפי שם קובץ…"
            aria-label="חיפוש לפי שם קובץ"
            className="admin-field-input !w-auto"
          />
        </div>
      </div>

      <AdminTable
        columns={['תצוגה מקדימה', 'קובץ', 'תיקייה', 'גודל', 'הועלה', 'צפיות', 'פעולות']}
        empty={filtered.length === 0 ? 'לא נמצאו קבצים.' : undefined}
      >
        {filtered.map((file) => (
          <MediaLibraryRow
            key={file.id}
            file={file}
            onReplace={(patch) => patchRow(file.id, patch)}
            onDelete={() => removeRow(file.id)}
          />
        ))}
      </AdminTable>
    </div>
  );
}

function MediaLibraryRow({
  file,
  onReplace,
  onDelete,
}: {
  file: MediaFileRow;
  onReplace: (patch: Partial<MediaFileRow>) => void;
  onDelete: () => void;
}) {
  const inputId = useId();
  const kind = fileKind(file);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * [1.19] ההעלאה קורית בצד הלקוח (upsert על אותו path, כמו uploadToBucket
   * ב-ImageField) ולא דרך Server Action — כדי שקובץ גדול לא יעבור דרך גוף
   * הבקשה של השרת. הכתובת הציבורית נשארת זהה, כך שכל מקום שכבר מפנה
   * לקובץ הזה (כריכת ספר, תמונת אירוע וכו') מציג את הגרסה החדשה מיד.
   */
  async function onReplaceFile(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];
    event.target.value = '';
    if (!nextFile) return;

    setReplacing(true);
    setError(null);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error('אין חיבור לאחסון');
      const { error: uploadError } = await supabase.storage
        .from(file.bucket_id)
        .upload(file.path, nextFile, { upsert: true, cacheControl: '31536000' });
      if (uploadError) throw new Error(uploadError.message);
      void recordAdminStorageReplace(file.bucket_id, file.path);
      onReplace({ size_bytes: nextFile.size, updated_at: new Date().toISOString() });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'ההחלפה נכשלה');
    } finally {
      setReplacing(false);
    }
  }

  function handleDelete() {
    startTransition(async () => {
      setError(null);
      const result = await deleteStorageFile(file.bucket_id as StorageBucket, file.path);
      if (result.error) setError(result.error);
      else onDelete();
    });
  }

  return (
    <AdminRow>
      <AdminCell>
        {kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element -- תצוגה מקדימה קטנה בטבלת ניהול
          <img
            src={file.publicUrl}
            alt=""
            loading="lazy"
            className="h-12 w-12 rounded-[var(--radius-sm)] border border-rule object-cover"
          />
        ) : (
          <span
            aria-label={kind === 'pdf' ? 'קובץ PDF' : kind === 'font' ? 'קובץ גופן' : 'קובץ'}
            className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-sm)] border border-rule bg-cream-2 text-caption font-semibold text-muted"
          >
            {KIND_BADGE[kind]}
          </span>
        )}
      </AdminCell>
      <AdminCell className="max-w-xs">
        <span className="block truncate" title={file.path}>
          {file.path}
        </span>
      </AdminCell>
      <AdminCell>{BUCKET_LABELS[file.bucket_id] ?? file.bucket_id}</AdminCell>
      <AdminCell className="tabular-nums">{formatBytes(file.size_bytes)}</AdminCell>
      <AdminCell>
        <span className="block">{formatDateTime(file.created_at)}</span>
        {file.uploader_name || file.uploader_email ? (
          <span className="block text-caption text-muted">{file.uploader_name ?? file.uploader_email}</span>
        ) : null}
      </AdminCell>
      <AdminCell className="tabular-nums">
        {file.viewCount != null ? `👁 ${file.viewCount.toLocaleString('he-IL')}` : '—'}
      </AdminCell>
      <AdminCell>
        <div className="flex items-center gap-1.5">
          <label
            htmlFor={inputId}
            title="החלפת קובץ"
            className={`admin-btn admin-btn-icon admin-btn-ghost cursor-pointer ${replacing ? 'pointer-events-none opacity-50' : ''}`}
          >
            <input
              id={inputId}
              type="file"
              accept={REPLACE_ACCEPT[kind] || undefined}
              className="sr-only"
              disabled={replacing}
              onChange={onReplaceFile}
              aria-label={`החלפת קובץ — ${file.path}`}
            />
            <AdminIcon name="upload" className="h-4 w-4" />
          </label>
          <a
            href={file.publicUrl}
            target="_blank"
            rel="noreferrer"
            title="פתיחה בכרטיסייה חדשה"
            className="admin-btn admin-btn-icon admin-btn-ghost"
          >
            <AdminIcon name="external" className="h-4 w-4" />
          </a>
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={`מחיקת ${file.path}`}
              title="מחיקה"
              className="admin-btn admin-btn-icon admin-btn-ghost"
            >
              <AdminIcon name="trash" className="h-4 w-4" />
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-caption">
              <span className="font-semibold text-[var(--admin-danger)]">למחוק?</span>
              <button
                type="button"
                disabled={pending}
                onClick={handleDelete}
                aria-label={`אישור מחיקת ${file.path}`}
                title="כן, למחוק"
                className="admin-btn admin-btn-icon admin-btn-ghost text-[var(--admin-danger)]"
              >
                <AdminIcon name="check" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                aria-label="ביטול מחיקה"
                title="ביטול"
                className="admin-btn admin-btn-icon admin-btn-ghost"
              >
                <AdminIcon name="x" className="h-4 w-4" />
              </button>
            </span>
          )}
        </div>
        {error ? <p className="mt-1 text-caption text-[var(--admin-danger)]">{error}</p> : null}
      </AdminCell>
    </AdminRow>
  );
}
