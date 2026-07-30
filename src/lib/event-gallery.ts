import type { EventBlock, EventRecord } from './supabase/types';
import type { LightboxImage } from '@/components/events/EventLightbox';

/**
 * מאחד את כל תמונות האירוע — בלוקי תמונה/שורת תמונות, ואחר כך הגלריה
 * המסיימת — לרשימה אחת עם אינדקס יציב. כך הבא/הקודם בתוך המגירה הצפה
 * עובר בין כל תמונות האירוע, לא רק בתוך הקבוצה שבה נלחץ.
 *
 * מחושב פעם אחת בשרת (לא ב-Client Component): גם event.blocks וגם
 * event.gallery כבר בזיכרון בעמוד, ואין טעם לחשב את זה מחדש בלקוח.
 */
export interface EventGalleryIndex {
  images: LightboxImage[];
  /** blockId (type='image') → אינדקס יחיד ב-images */
  blockImageIndex: Map<string, number>;
  /** blockId (type='image_row') → אינדקס לכל תמונה בשורה, לפי סדר */
  blockRowIndexes: Map<string, number[]>;
  /** האינדקס שבו מתחילות תמונות הגלריה המסיימת */
  closingGalleryStart: number;
}

export function buildEventGalleryIndex(event: EventRecord): EventGalleryIndex {
  const images: LightboxImage[] = [];
  const blockImageIndex = new Map<string, number>();
  const blockRowIndexes = new Map<string, number[]>();

  for (const block of event.blocks ?? []) {
    if (block.type === 'image' && block.image_url) {
      blockImageIndex.set(block.id, images.length);
      images.push({ url: block.image_url, alt: block.image_alt ?? '', caption: block.image_caption_he });
    } else if (block.type === 'image_row' && block.images.length > 0) {
      const indexes: number[] = [];
      for (const image of block.images) {
        indexes.push(images.length);
        images.push({ url: image.url, alt: image.alt ?? '', caption: image.caption_he });
      }
      blockRowIndexes.set(block.id, indexes);
    }
  }

  const closingGalleryStart = images.length;
  for (const image of event.gallery ?? []) {
    images.push({ url: image.url, alt: image.caption_he ?? '', caption: image.caption_he ?? null });
  }

  return { images, blockImageIndex, blockRowIndexes, closingGalleryStart };
}

/**
 * תחנות מד ההתקדמות: כל תווית stage_label ייחודית, לפי סדר הופעתה
 * הראשונה בין הבלוקים. בלי רשימה סגורה בקוד — לכל אירוע התחנות שהעורך
 * בחר לו.
 */
export function extractEventStages(blocks: EventBlock[]): {
  labels: string[];
  blockStageIndex: Map<string, number>;
} {
  const labels: string[] = [];
  const blockStageIndex = new Map<string, number>();

  for (const block of blocks) {
    if (!block.stage_label) continue;
    let index = labels.indexOf(block.stage_label);
    if (index === -1) {
      index = labels.length;
      labels.push(block.stage_label);
    }
    blockStageIndex.set(block.id, index);
  }

  return { labels, blockStageIndex };
}
