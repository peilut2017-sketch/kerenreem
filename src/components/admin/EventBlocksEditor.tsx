'use client';

import { useState, useTransition } from 'react';
import { Img as Image } from '@/components/Img';
import { uploadToBucket } from './ImageField';
import { Spinner } from './SubmitButton';
import { saveEventBlocks } from '@/lib/admin/actions';
import type { EventBlock, EventBlockType } from '@/lib/supabase/types';

const TYPE_LABELS: Record<EventBlockType, string> = {
  text: 'פסקה',
  image: 'תמונה גדולה',
  image_row: 'שורת תמונות',
  video: 'וידאו',
  quote: 'ציטוט',
};

interface ImageRow {
  key: number;
  url: string;
  alt: string;
  caption_he: string;
}

interface BlockRow {
  key: number;
  type: EventBlockType;
  stage_label: string;
  body_he: string;
  image_url: string;
  image_alt: string;
  image_caption_he: string;
  images: ImageRow[];
  video_url: string;
  video_caption_he: string;
  quote_text: string;
  quote_attribution_he: string;
}

let nextKey = 0;
function makeImageRow(image?: { url?: string | null; alt?: string | null; caption_he?: string | null }): ImageRow {
  nextKey += 1;
  return { key: nextKey, url: image?.url ?? '', alt: image?.alt ?? '', caption_he: image?.caption_he ?? '' };
}

function makeBlockRow(type: EventBlockType, block?: EventBlock): BlockRow {
  nextKey += 1;
  return {
    key: nextKey,
    type,
    stage_label: block?.stage_label ?? '',
    body_he: block?.body_he ?? '',
    image_url: block?.image_url ?? '',
    image_alt: block?.image_alt ?? '',
    image_caption_he: block?.image_caption_he ?? '',
    images: (block?.images ?? []).map((image) => makeImageRow(image)),
    video_url: block?.video_url ?? '',
    video_caption_he: block?.video_caption_he ?? '',
    quote_text: block?.quote_text ?? '',
    quote_attribution_he: block?.quote_attribution_he ?? '',
  };
}

/**
 * עורך "בלוקי הסיפור" של האירוע — הרצף שמחליף את "כל הטקסט ואז כל
 * הגלריה בסוף". כל שורה היא בלוק מסוג אחד (פסקה / תמונה גדולה / שורת
 * תמונות / וידאו / ציטוט); הסדר ברשימה כאן הוא סדר ההופעה בעמוד.
 *
 * נשמר בפעולת שרת נפרדת מטופס האירוע עצמו (ראו saveEventBlocks),
 * מאותה סיבה בדיוק כמו BookTocEditor/BookImagesEditor: event_blocks
 * היא טבלה נפרדת ולא שדה על האירוע.
 */
export function EventBlocksEditor({ eventId, blocks }: { eventId: string; blocks: EventBlock[] }) {
  const [rows, setRows] = useState<BlockRow[]>(() =>
    blocks.map((block) => makeBlockRow(block.type, block)),
  );
  const [uploading, setUploading] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  function update(key: number, patch: Partial<BlockRow>) {
    setStatus('idle');
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function move(key: number, direction: -1 | 1) {
    setRows((current) => {
      const index = current.findIndex((row) => row.key === key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function uploadInto(uploadKey: string, onDone: (url: string) => void, file: File) {
    setUploading(uploadKey);
    setError(null);
    try {
      onDone(await uploadToBucket('events', file));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(null);
    }
  }

  function save() {
    startTransition(async () => {
      setStatus('idle');
      setError(null);
      const result = await saveEventBlocks(
        eventId,
        rows.map((row) => ({
          type: row.type,
          stage_label: row.stage_label,
          body_he: row.body_he,
          image_url: row.image_url,
          image_alt: row.image_alt,
          image_caption_he: row.image_caption_he,
          images: row.images
            .filter((image) => image.url)
            .map(({ url, alt, caption_he }) => ({ url, alt, caption_he })),
          video_url: row.video_url,
          video_caption_he: row.video_caption_he,
          quote_text: row.quote_text,
          quote_attribution_he: row.quote_attribution_he,
        })),
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
        {rows.map((row, index) => (
          <div key={row.key} className="border border-rule p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <span className="eyebrow">{TYPE_LABELS[row.type]}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => move(row.key, -1)}
                  disabled={index === 0}
                  aria-label="הזזה למעלה"
                  className="rounded-[var(--radius-sm)] border border-rule px-2 py-1 text-caption disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(row.key, 1)}
                  disabled={index === rows.length - 1}
                  aria-label="הזזה למטה"
                  className="rounded-[var(--radius-sm)] border border-rule px-2 py-1 text-caption disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                  className="text-caption text-burgundy underline underline-offset-4"
                >
                  הסרה
                </button>
              </div>
            </div>

            <label className="mb-4 block max-w-xs">
              <span className="field-label">תג תחנה (רשות)</span>
              <input
                value={row.stage_label}
                onChange={(event) => update(row.key, { stage_label: event.target.value })}
                placeholder="קבלת פנים, השיעור, סיום…"
                className="field-input mt-1"
              />
              <span className="field-hint">
                מופיע במד ההתקדמות שבראש העמוד. משאירים ריק ברוב הבלוקים.
              </span>
            </label>

            {row.type === 'text' ? (
              <label className="block">
                <span className="field-label">טקסט</span>
                <textarea
                  value={row.body_he}
                  onChange={(event) => update(row.key, { body_he: event.target.value })}
                  rows={4}
                  className="field-input mt-1"
                />
              </label>
            ) : null}

            {row.type === 'image' ? (
              <ImagePicker
                uploadKey={`${row.key}`}
                uploading={uploading}
                url={row.image_url}
                alt={row.image_alt}
                caption={row.image_caption_he}
                onFile={(file) => void uploadInto(`${row.key}`, (url) => update(row.key, { image_url: url }), file)}
                onAlt={(alt) => update(row.key, { image_alt: alt })}
                onCaption={(caption) => update(row.key, { image_caption_he: caption })}
              />
            ) : null}

            {row.type === 'image_row' ? (
              <div>
                <p className="mb-3 text-caption text-muted">2–4 תמונות שיוצגו יחד באותה שורה.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {row.images.map((image) => (
                    <div key={image.key} className="border border-rule p-3">
                      <ImagePicker
                        uploadKey={`${row.key}:${image.key}`}
                        uploading={uploading}
                        url={image.url}
                        alt={image.alt}
                        caption={image.caption_he}
                        onFile={(file) =>
                          void uploadInto(`${row.key}:${image.key}`, (url) =>
                            update(row.key, {
                              images: row.images.map((i) => (i.key === image.key ? { ...i, url } : i)),
                            }),
                          file)
                        }
                        onAlt={(alt) =>
                          update(row.key, {
                            images: row.images.map((i) => (i.key === image.key ? { ...i, alt } : i)),
                          })
                        }
                        onCaption={(caption) =>
                          update(row.key, {
                            images: row.images.map((i) =>
                              i.key === image.key ? { ...i, caption_he: caption } : i,
                            ),
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          update(row.key, { images: row.images.filter((i) => i.key !== image.key) })
                        }
                        className="mt-2 text-caption text-burgundy underline underline-offset-4"
                      >
                        הסרת התמונה
                      </button>
                    </div>
                  ))}
                </div>
                {row.images.length < 4 ? (
                  <button
                    type="button"
                    onClick={() => update(row.key, { images: [...row.images, makeImageRow()] })}
                    className="btn btn-quiet mt-3"
                  >
                    + הוספת תמונה לשורה
                  </button>
                ) : null}
              </div>
            ) : null}

            {row.type === 'video' ? (
              <div className="space-y-3">
                <label className="block">
                  <span className="field-label">כתובת הסרטון</span>
                  <input
                    type="url"
                    dir="ltr"
                    value={row.video_url}
                    onChange={(event) => update(row.key, { video_url: event.target.value })}
                    placeholder="https://youtube.com/watch?v=…"
                    className="field-input mt-1"
                  />
                </label>
                <label className="block">
                  <span className="field-label">כיתוב (רשות)</span>
                  <input
                    value={row.video_caption_he}
                    onChange={(event) => update(row.key, { video_caption_he: event.target.value })}
                    className="field-input mt-1"
                  />
                </label>
              </div>
            ) : null}

            {row.type === 'quote' ? (
              <div className="space-y-3">
                <label className="block">
                  <span className="field-label">הציטוט</span>
                  <textarea
                    value={row.quote_text}
                    onChange={(event) => update(row.key, { quote_text: event.target.value })}
                    rows={3}
                    className="field-input mt-1"
                  />
                </label>
                <label className="block">
                  <span className="field-label">מקור הציטוט (רשות)</span>
                  <input
                    value={row.quote_attribution_he}
                    onChange={(event) => update(row.key, { quote_attribution_he: event.target.value })}
                    placeholder="הרב…"
                    className="field-input mt-1"
                  />
                </label>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(Object.keys(TYPE_LABELS) as EventBlockType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setRows((current) => [...current, makeBlockRow(type)])}
            className="btn btn-quiet"
          >
            + {TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3 border-t border-rule pt-5">
        <button type="button" onClick={save} disabled={pending} className="btn btn-solid">
          {pending ? 'שומר…' : 'שמירת רצף הסיפור'}
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

function ImagePicker({
  uploadKey,
  uploading,
  url,
  alt,
  caption,
  onFile,
  onAlt,
  onCaption,
}: {
  uploadKey: string;
  uploading: string | null;
  url: string;
  alt: string;
  caption: string;
  onFile: (file: File) => void;
  onAlt: (value: string) => void;
  onCaption: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
      <div>
        <div className="relative aspect-3/4 w-full overflow-hidden rounded-[var(--radius-sm)] bg-cream-2">
          {url ? <Image src={url} alt="" fill sizes="128px" className="object-cover" /> : null}
        </div>
        <label className="mt-2 block">
          <span className="sr-only">העלאת תמונה</span>
          <input
            type="file"
            accept="image/*"
            disabled={uploading === uploadKey}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFile(file);
            }}
            className="text-caption"
          />
        </label>
        {uploading === uploadKey ? (
          <span className="mt-1 inline-flex items-center gap-1.5 text-caption text-muted">
            <Spinner className="h-3 w-3" /> מעלה…
          </span>
        ) : null}
      </div>
      <div className="space-y-3">
        <label className="block">
          <span className="field-label">טקסט חלופי</span>
          <input value={alt} onChange={(event) => onAlt(event.target.value)} className="field-input mt-1" />
        </label>
        <label className="block">
          <span className="field-label">כיתוב</span>
          <input
            value={caption}
            onChange={(event) => onCaption(event.target.value)}
            className="field-input mt-1"
          />
        </label>
      </div>
    </div>
  );
}
