import Image from 'next/image';

/**
 * כריכת ספר — האלמנט הוויזואלי המרכזי באתר.
 *
 * שתי החלטות מכוונות:
 * 1. object-contain ולא object-cover — כריכת ספר היא טקסט; חיתוך בולע את
 *    שם הספר. הכריכות בעלות פרופורציות שונות ולכן הן מיושרות לתחתית,
 *    כמו ספרים העומדים על מדף.
 * 2. כשאין תמונה, מוצג "שער" טיפוגרפי עם שם הספר — לא ריבוע אפור.
 *    בקטלוג שנבנה בהדרגה זה המצב הנפוץ, וראוי שייראה מכובד.
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
    return (
      <div
        className="flex aspect-3/4 w-full items-center justify-center border border-rule bg-paper-2 px-4"
        role="img"
        aria-label={alt}
      >
        <span className="text-center font-serif text-[0.95rem] leading-snug text-ink-soft">
          {title}
        </span>
      </div>
    );
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
