'use client';

import { useCallback, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  addEventMedia,
  deleteEventMedia,
  reorderEventMedia,
  saveEventChapters,
  updateEventMedia,
  type NewMediaItem,
} from '@/lib/admin/event-media-actions';
import { toCdnUrl } from '@/lib/image-src';
import { uploadToBucket } from './ImageField';
import { AdminIcon } from './AdminIcons';
import { Spinner } from './SubmitButton';
import type { EventChapter, EventMediaItem } from '@/lib/supabase/types';

/**
 * [1.11] "מדיה וסיפור האירוע" — ה-CMS של Event Story Gallery:
 * העלאה מרובה (בחירה או גרירה מהמחשב), וידאו YouTube/Vimeo, סידור
 * בגרירה (dnd-kit, כולל מקלדת), שיוך לשלבים, כתובית/alt, נקודת מיקוד,
 * מובלטת, הסתרה ומחיקה. שמירת הסדר נעשית בקריאה אחת (reorderEventMedia)
 * עם עדכון אופטימי — הרשת מתעדכנת ברקע.
 */

type MediaRow = EventMediaItem;

function parseVideoUrl(raw: string): { provider: 'youtube' | 'vimeo'; id: string } | null {
  const youtube = raw.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,20})/,
  );
  if (youtube) return { provider: 'youtube', id: youtube[1] };
  const vimeo = raw.match(/vimeo\.com\/(?:video\/)?(\d{6,12})/);
  if (vimeo) return { provider: 'vimeo', id: vimeo[1] };
  return null;
}

function imageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

const FOCAL_OPTIONS = [
  { label: 'מרכז', x: 0.5, y: 0.5 },
  { label: 'למעלה', x: 0.5, y: 0.15 },
  { label: 'למטה', x: 0.5, y: 0.85 },
] as const;

export function EventStoryMediaManager({
  eventId,
  media: initialMedia,
  chapters: initialChapters,
}: {
  eventId: string;
  media: MediaRow[];
  chapters: EventChapter[];
}) {
  const router = useRouter();
  const [media, setMedia] = useState<MediaRow[]>(initialMedia);
  const [chapters, setChapters] = useState(
    initialChapters.map((chapter) => ({
      id: chapter.id as string | null,
      title_he: chapter.title_he,
      description_he: chapter.description_he ?? '',
    })),
  );
  const [orderStatus, setOrderStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [uploading, setUploading] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, startTransition] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const chapterOptions = useMemo(
    () => chapters.filter((chapter) => chapter.id && chapter.title_he.trim()),
    [chapters],
  );

  /** שמירת הסדר הנוכחי — מושהית מעט, כדי שכמה גרירות רצופות יתאחדו. */
  const queueOrderSave = useCallback(
    (rows: MediaRow[]) => {
      setOrderStatus('saving');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const result = await reorderEventMedia(
          eventId,
          rows.map((row, index) => ({ id: row.id, sort_order: index, chapter_id: row.chapter_id })),
        );
        setOrderStatus(result?.error ? 'error' : 'saved');
      }, 600);
    },
    [eventId],
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setMedia((rows) => {
      const from = rows.findIndex((row) => row.id === active.id);
      const to = rows.findIndex((row) => row.id === over.id);
      const next = arrayMove(rows, from, to);
      queueOrderSave(next);
      return next;
    });
  }

  async function ingestFiles(files: FileList | File[]) {
    const images = [...files].filter((file) => file.type.startsWith('image/'));
    if (images.length === 0) return;
    setError(null);
    const items: NewMediaItem[] = [];
    let done = 0;
    for (const file of images) {
      setUploading(`מעלה ${done + 1} מתוך ${images.length}…`);
      try {
        const [url, size] = await Promise.all([
          uploadToBucket('events', file, `story/${eventId}`),
          imageDimensions(file),
        ]);
        items.push({ type: 'image', url, width: size?.width ?? null, height: size?.height ?? null });
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : String(uploadError));
      }
      done += 1;
    }
    setUploading(null);
    if (items.length > 0) {
      startTransition(async () => {
        const result = await addEventMedia(eventId, items);
        if (result?.error) {
          setError(result.error);
        } else if (result?.items?.length) {
          // [1.14] הצגה מיידית — לא ממתינים ל-router.refresh() כדי לראות
          // את הפריטים שהועלו הרגע; הפעולה כבר מחזירה אותם עם ה-id שלהם
          setMedia((rows) => [...rows, ...result.items!]);
        }
        router.refresh();
      });
    }
  }

  function addVideo() {
    const parsed = parseVideoUrl(videoUrl.trim());
    if (!parsed) {
      setError('קישור וידאו לא מזוהה — נתמכים YouTube ו-Vimeo');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addEventMedia(eventId, [
        {
          type: 'video',
          url: videoUrl.trim(),
          video_provider: parsed.provider,
          video_id: parsed.id,
          thumbnail_url:
            parsed.provider === 'youtube' ? `https://i.ytimg.com/vi/${parsed.id}/hqdefault.jpg` : null,
        },
      ]);
      if (result?.error) {
        setError(result.error);
      } else {
        if (result?.items?.length) setMedia((rows) => [...rows, ...result.items!]);
        setVideoUrl('');
      }
      router.refresh();
    });
  }

  function patchItem(id: string, patch: Partial<MediaRow>, persist: Parameters<typeof updateEventMedia>[1]) {
    setMedia((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    startTransition(async () => {
      const result = await updateEventMedia(id, persist);
      if (result?.error) setError(result.error);
    });
  }

  function removeItem(id: string) {
    setMedia((rows) => rows.filter((row) => row.id !== id));
    startTransition(async () => {
      const result = await deleteEventMedia(id);
      if (result?.error) setError(result.error);
      router.refresh();
    });
  }

  function saveChapters() {
    startTransition(async () => {
      setError(null);
      const result = await saveEventChapters(
        eventId,
        chapters.map((chapter) => ({
          id: chapter.id,
          title_he: chapter.title_he,
          description_he: chapter.description_he,
        })),
      );
      if (result?.error) setError(result.error);
      router.refresh();
    });
  }

  return (
    <section className="admin-card space-y-6 px-5 py-5">
      <header>
        <h2 className="font-serif text-h3 text-ink">מדיה וסיפור האירוע</h2>
        <p className="mt-1 text-caption text-muted">
          העלו את תמונות וסרטוני האירוע, גררו לסדר הרצוי, חלקו לשלבים והוסיפו כתוביות —
          מהתוכן הזה נבנה סיפור האירוע באתר: פריסה עריכתית במחשב וחוויית דפדוף במובייל.
        </p>
      </header>

      {/* שלבי האירוע */}
      <div className="rounded-[var(--radius-md)] border border-rule p-4">
        <h3 className="admin-field-label mb-2">שלבי האירוע (רשות)</h3>
        <p className="mb-3 text-caption text-muted">
          למשל: התכנסות, דברי פתיחה, השיעור המרכזי, חלוקת הספרים. כל פריט מדיה אפשר לשייך
          לשלב, והסיפור באתר יוצג לפי השלבים.
        </p>
        <div className="space-y-2">
          {chapters.map((chapter, index) => (
            <div key={chapter.id ?? `new-${index}`} className="flex flex-wrap items-center gap-2">
              <span className="text-caption text-muted tabular-nums">{index + 1}.</span>
              <input
                type="text"
                value={chapter.title_he}
                onChange={(event) =>
                  setChapters((rows) =>
                    rows.map((row, i) => (i === index ? { ...row, title_he: event.target.value } : row)),
                  )
                }
                placeholder="שם השלב"
                aria-label={`שם שלב ${index + 1}`}
                className="admin-field-input w-56"
              />
              <button
                type="button"
                onClick={() => setChapters((rows) => rows.filter((_, i) => i !== index))}
                className="admin-btn admin-btn-ghost"
                aria-label={`הסרת שלב ${chapter.title_he || index + 1}`}
              >
                <AdminIcon name="x" className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setChapters((rows) => [...rows, { id: null, title_he: '', description_he: '' }])}
            className="admin-btn admin-btn-quiet"
          >
            <AdminIcon name="plus" className="h-4 w-4" />
            הוספת שלב
          </button>
          <button type="button" disabled={pending} onClick={saveChapters} className="admin-btn admin-btn-solid">
            {pending ? <Spinner className="h-3.5 w-3.5" /> : null}
            שמירת השלבים
          </button>
        </div>
      </div>

      {/* העלאה */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          void ingestFiles(event.dataTransfer.files);
        }}
        className={`rounded-[var(--radius-md)] border-2 border-dashed p-6 text-center transition-colors ${
          dragOver ? 'border-[var(--admin-accent)] bg-[var(--admin-accent-soft)]' : 'border-rule-strong'
        }`}
      >
        <p className="text-small text-ink-soft">גררו לכאן תמונות מהמחשב, או</p>
        <label className="admin-btn admin-btn-quiet mt-2 inline-flex cursor-pointer">
          בחירת קבצים
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(event) => {
              if (event.target.files) void ingestFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </label>
        {uploading ? (
          <p className="mt-2 text-caption text-muted" role="status">
            <Spinner className="me-1 inline h-3 w-3" /> {uploading}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <input
            type="url"
            dir="ltr"
            value={videoUrl}
            onChange={(event) => setVideoUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            aria-label="קישור וידאו (YouTube או Vimeo)"
            className="admin-field-input w-72"
          />
          <button type="button" disabled={pending || !videoUrl.trim()} onClick={addVideo} className="admin-btn admin-btn-quiet">
            <AdminIcon name="video" className="h-4 w-4" />
            הוספת וידאו
          </button>
        </div>
      </div>

      {/* רשת הפריטים הניתנת לגרירה */}
      {media.length > 0 ? (
        <>
          <p className="text-caption text-muted" role="status">
            {orderStatus === 'saving'
              ? 'שמירת סדר…'
              : orderStatus === 'saved'
                ? 'הסדר נשמר'
                : orderStatus === 'error'
                  ? 'שמירת הסדר נכשלה — נסו שוב'
                  : `${media.length} פריטים. גררו לשינוי הסדר (או Space + חצים במקלדת).`}
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={media.map((row) => row.id)} strategy={rectSortingStrategy}>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {media.map((row, index) => (
                  <SortableMediaCard
                    key={row.id}
                    row={row}
                    index={index}
                    chapters={chapterOptions}
                    onPatch={patchItem}
                    onRemove={removeItem}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </>
      ) : (
        <p className="text-small text-muted">טרם הועלתה מדיה לאירוע הזה.</p>
      )}

      {error ? (
        <p role="alert" className="text-small text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function SortableMediaCard({
  row,
  index,
  chapters,
  onPatch,
  onRemove,
}: {
  row: MediaRow;
  index: number;
  chapters: { id: string | null; title_he: string }[];
  onPatch: (id: string, patch: Partial<MediaRow>, persist: Parameters<typeof updateEventMedia>[1]) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });
  const [caption, setCaption] = useState(row.caption_he ?? '');
  const [alt, setAlt] = useState(row.alt_he ?? '');
  const focalValue =
    FOCAL_OPTIONS.find((option) => option.x === Number(row.focal_x) && option.y === Number(row.focal_y))
      ?.label ?? 'מרכז';

  const preview = row.type === 'video' ? (row.thumbnail_url ?? null) : (row.thumbnail_url ?? row.url);

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
      }}
      className={`rounded-[var(--radius-md)] border bg-white/80 p-2.5 ${
        isDragging
          ? 'scale-[1.03] border-[var(--admin-accent)] shadow-[var(--admin-shadow-hover)]'
          : 'border-rule'
      } ${row.is_visible ? '' : 'opacity-55'}`}
    >
      <div className="relative">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- תמונונת ניהול קטנה
          <img
            src={toCdnUrl(preview)}
            alt={row.alt_he ?? ''}
            className="h-32 w-full rounded-[var(--radius-sm)] object-cover"
            style={{ objectPosition: `${Number(row.focal_x) * 100}% ${Number(row.focal_y) * 100}%` }}
            loading="lazy"
          />
        ) : (
          <span className="flex h-32 w-full items-center justify-center rounded-[var(--radius-sm)] bg-cream-2 text-muted">
            <AdminIcon name="video" className="h-6 w-6" />
          </span>
        )}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`גרירת פריט ${index + 1}`}
          className="absolute start-1.5 top-1.5 cursor-grab rounded-[var(--radius-sm)] bg-white/85 px-1.5 py-1 text-ink-soft shadow active:cursor-grabbing"
        >
          ⠿
        </button>
        <span className="absolute end-1.5 top-1.5 flex gap-1">
          <button
            type="button"
            onClick={() => onPatch(row.id, { is_featured: !row.is_featured }, { is_featured: !row.is_featured })}
            aria-pressed={row.is_featured}
            aria-label="סימון כמובלטת"
            title="מובלטת — משמשת כתמונה מרכזית בסיפור"
            className={`rounded-[var(--radius-sm)] px-1.5 py-1 shadow ${
              row.is_featured ? 'bg-[var(--admin-accent)] text-white' : 'bg-white/85 text-ink-soft'
            }`}
          >
            ★
          </button>
          <button
            type="button"
            onClick={() => onPatch(row.id, { is_visible: !row.is_visible }, { is_visible: !row.is_visible })}
            aria-pressed={!row.is_visible}
            aria-label={row.is_visible ? 'הסתרת הפריט' : 'הצגת הפריט'}
            title={row.is_visible ? 'מוצג באתר — לחיצה תסתיר' : 'מוסתר — לחיצה תציג'}
            className="rounded-[var(--radius-sm)] bg-white/85 px-1.5 py-1 text-ink-soft shadow"
          >
            {row.is_visible ? '👁' : '🚫'}
          </button>
        </span>
        {row.type === 'video' ? (
          <span className="absolute bottom-1.5 start-1.5 rounded-[var(--radius-pill)] bg-black/60 px-2 py-0.5 text-[0.7rem] text-white">
            וידאו
          </span>
        ) : null}
      </div>

      <div className="mt-2 space-y-1.5">
        <input
          type="text"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          onBlur={() => {
            if (caption !== (row.caption_he ?? '')) {
              onPatch(row.id, { caption_he: caption }, { caption_he: caption });
            }
          }}
          placeholder="כתובית (רשות)"
          aria-label={`כתובית לפריט ${index + 1}`}
          className="admin-field-input py-1.5 text-caption"
        />
        <input
          type="text"
          value={alt}
          onChange={(event) => setAlt(event.target.value)}
          onBlur={() => {
            if (alt !== (row.alt_he ?? '')) onPatch(row.id, { alt_he: alt }, { alt_he: alt });
          }}
          placeholder="טקסט חלופי (נגישות)"
          aria-label={`טקסט חלופי לפריט ${index + 1}`}
          className="admin-field-input py-1.5 text-caption"
        />
        <div className="flex gap-1.5">
          <select
            value={row.chapter_id ?? ''}
            onChange={(event) =>
              onPatch(row.id, { chapter_id: event.target.value || null }, { chapter_id: event.target.value || null })
            }
            aria-label={`שלב לפריט ${index + 1}`}
            className="admin-field-input min-w-0 flex-1 py-1.5 text-caption"
          >
            <option value="">ללא שלב</option>
            {chapters.map((chapter) => (
              <option key={chapter.id ?? ''} value={chapter.id ?? ''}>
                {chapter.title_he}
              </option>
            ))}
          </select>
          <select
            value={focalValue}
            onChange={(event) => {
              const option = FOCAL_OPTIONS.find((item) => item.label === event.target.value) ?? FOCAL_OPTIONS[0];
              onPatch(row.id, { focal_x: option.x, focal_y: option.y }, { focal_x: option.x, focal_y: option.y });
            }}
            aria-label={`נקודת מיקוד לפריט ${index + 1}`}
            title="נקודת מיקוד — איזה חלק נשמר כשהתמונה נחתכת"
            className="admin-field-input w-24 py-1.5 text-caption"
          >
            {FOCAL_OPTIONS.map((option) => (
              <option key={option.label} value={option.label}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('למחוק את הפריט מהסיפור?')) onRemove(row.id);
            }}
            aria-label={`מחיקת פריט ${index + 1}`}
            className="admin-btn admin-btn-danger px-2 py-1.5"
          >
            <AdminIcon name="trash" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}
