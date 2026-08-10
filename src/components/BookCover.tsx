import { Img as Image } from '@/components/Img';
import { BookCoverPlaceholder } from '@/components/BookCoverPlaceholder';

/**
 * כריכת ספר — האלמנט הוויזואלי המרכזי באתר.
 *
 * שתי החלטות מכוונות:
 * 1. object-contain ולא object-cover — כריכת ספר היא טקסט; חיתוך בולע את
 *    שם הספר. הכריכות בעלות פרופורציות שונות ולכן הן מיושרות לתחתית,
 *    כמו ספרים העומדים על מדף.
 * 2. [1.10] כשאין תמונה, מוצגת כריכה גנרית מוטבעת (BookCoverPlaceholder)
 *    — לא ריבוע אפור. בקטלוג שנבנה בהדרגה זה המצב הנפוץ, וראוי שייראה מכובד.
 */
export function BookCover({
  src,
  title,
  alt,
  priority = false,
  sizes = '(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px',
}: {
  src: string | null | undefined;
  title: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
}) {
  if (!src) {
    return <BookCoverPlaceholder title={title} />;
  }

  return (
    <div className="relative flex aspect-3/4 w-full items-end justify-center">
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-contain object-bottom"
      />
    </div>
  );
}
