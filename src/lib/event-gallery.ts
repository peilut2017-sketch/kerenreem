import type { EventBlock, EventMediaItem, EventRecord, GalleryImage } from './supabase/types';
import type { LightboxImage } from '@/components/events/EventLightbox';

/**
 * מאחד את תמונות בלוקי הסיפור (רצף הטקסט השזור) לרשימה אחת עם אינדקס
 * יציב, לתצוגת Lightbox בלחיצה על תמונה בגוף הטקסט. [1.14] הגלריה
 * המסיימת אינה חלק מהאינדקס הזה יותר — היא מוצגת כעת דרך
 * EventStoryGallery (ראו legacyGalleryToMedia למטה), לא דרך ה-Lightbox
 * הישן.
 *
 * מחושב פעם אחת בשרת (לא ב-Client Component): event.blocks כבר בזיכרון
 * בעמוד, ואין טעם לחשב את זה מחדש בלקוח.
 */
export interface EventGalleryIndex {
  images: LightboxImage[];
  /** blockId (type='image') → אינדקס יחיד ב-images */
  blockImageIndex: Map<string, number>;
  /** blockId (type='image_row') → אינדקס לכל תמונה בשורה, לפי סדר */
  blockRowIndexes: Map<string, number[]>;
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

  return { images, blockImageIndex, blockRowIndexes };
}

/**
 * [1.14] הגלריה הישנה (events.gallery jsonb) מותאמת בזמן קריאה לצורת
 * EventMediaItem — כדי שאירוע שעדיין לא הועברה לו מדיה לטבלה החדשה
 * (event_media) ימשיך להציג את תמונותיו דרך EventStoryGallery, ולא
 * דרך רכיבי הגלריה הישנים (שהוסרו). ה-id הסינתטי יציב לפי סדר, כדי
 * ש-deep link (?media=) יעבוד גם על אירוע כזה בתוך ביקור בודד.
 */
export function legacyGalleryToMedia(eventId: string, gallery: GalleryImage[]): EventMediaItem[] {
  const now = '';
  return gallery
    .filter((image) => image.url)
    .map((image, index) => ({
      id: `legacy-${eventId}-${index}`,
      event_id: eventId,
      type: 'image',
      url: image.url,
      thumbnail_url: null,
      caption_he: image.caption_he ?? null,
      caption_en: image.caption_en ?? null,
      alt_he: image.caption_he ?? null,
      alt_en: image.caption_en ?? null,
      sort_order: index,
      chapter_id: null,
      is_featured: false,
      is_visible: true,
      focal_x: 0.5,
      focal_y: 0.5,
      width: null,
      height: null,
      duration: null,
      video_provider: null,
      video_id: null,
      view_count: 0,
      created_at: now,
      updated_at: now,
    }));
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
