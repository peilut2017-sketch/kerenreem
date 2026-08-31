import {
  EventImageBlock,
  EventImageRowBlock,
  EventQuoteBlock,
  EventTextBlock,
  EventVideoBlock,
} from './EventBlocks';
import { localized } from '@/lib/localized';
import type { EventGalleryIndex } from '@/lib/event-gallery';
import type { EventBlock } from '@/lib/supabase/types';

/**
 * מתרגם את רצף הבלוקים לרכיבי התצוגה שלהם, לפי type. Server Component:
 * כל אחד מרכיבי הבלוק עצמם 'use client' (הם צריכים hooks של גלילה
 * ולחיצה), אבל המיפוי בין הנתונים לרכיב לא צריך את זה.
 *
 * בלוק עם stage_label עטוף ב-div עם data-stage-index — העוגן שממנו
 * EventJourneyProgress קורא איזו תחנה פעילה כרגע (ראו extractEventStages).
 */
export function EventBlockList({
  blocks,
  gallery,
  eventTitle,
  blockStageIndex,
  locale,
}: {
  blocks: EventBlock[];
  gallery: EventGalleryIndex;
  eventTitle: string;
  blockStageIndex: Map<string, number>;
  locale: string;
}) {
  return (
    <div className="space-y-10 sm:space-y-14">
      {blocks.map((block) => {
        const content = renderBlock(block, gallery, eventTitle, locale);
        if (!content) return null;

        const stageIndex = blockStageIndex.get(block.id);
        if (stageIndex === undefined) return <div key={block.id}>{content}</div>;

        return (
          <div key={block.id} data-stage-index={stageIndex}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

function renderBlock(
  block: EventBlock,
  gallery: EventGalleryIndex,
  eventTitle: string,
  locale: string,
): React.ReactNode {
  switch (block.type) {
    case 'text': {
      // ‏localized ולא body_he ישירות: לבלוק טקסט יש body_en בסכימה,
      // ומבקר אנגלית קיבל עד עכשיו את העברית גם כשתרגום קיים. שאר
      // הכיתובים (caption/attribution) הם עברית-בלבד בסכימה — שם אין
      // מה לבחור.
      const body = localized(block, 'body', locale);
      return body ? <EventTextBlock text={body} /> : null;
    }

    case 'image': {
      const imageIndex = gallery.blockImageIndex.get(block.id);
      if (!block.image_url || imageIndex === undefined) return null;
      return (
        <EventImageBlock
          url={block.image_url}
          alt={block.image_alt ?? ''}
          caption={block.image_caption_he}
          imageIndex={imageIndex}
        />
      );
    }

    case 'image_row': {
      const indexes = gallery.blockRowIndexes.get(block.id);
      if (!indexes || block.images.length === 0) return null;
      return <EventImageRowBlock images={block.images} indexes={indexes} />;
    }

    case 'video':
      return block.video_url ? (
        <EventVideoBlock url={block.video_url} caption={block.video_caption_he} title={eventTitle} />
      ) : null;

    case 'quote':
      return block.quote_text ? (
        <EventQuoteBlock text={block.quote_text} attribution={block.quote_attribution_he} />
      ) : null;

    default:
      return null;
  }
}
