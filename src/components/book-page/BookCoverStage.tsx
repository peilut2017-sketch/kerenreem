import { Img as Image } from '@/components/Img';

/**
 * הכריכה ב-Hero — לא עוד ניסיון לצייר "ספר עומד" ב-CSS.
 *
 * הגרסה הקודמת (FloatingCover) הרכיבה שדרה, ברק אלכסוני ו-rotateY קבוע
 * מעל כל תמונת כריכה, כדי לדמות עומק פיזי בלי נכס גרפי אמיתי. זה עבד,
 * אבל תמיד נראה מעט מלאכותי — ובעיקר, אם יש כבר נכס mockup מוכן (עם
 * שדרה, עובי ותאורה מצולמים/מעוצבים מראש), שכבות ה-CSS האלה מצטברות
 * מעל עומק שכבר קיים בתמונה ומייצרות כפל.
 *
 * הכלל כאן פשוט: כש-hero_mockup_url קיים, הוא מוצג כמות שהוא — בלי שום
 * שכבת CSS שמנסה "לתקן" אותו. כשאין mockup, מוצגת הכריכה השטוחה
 * (cover_image_url) נקייה, בלי שדרה מומצאת. צל הקרקע נשאר בשני המקרים:
 * זו תאורת סביבה (איך האור נופל על המשטח שהספר "עומד" עליו), לא ניסיון
 * לצייר את הספר עצמו.
 */
export function BookCoverStage({
  cover,
  mockup,
  title,
  alt,
}: {
  cover: string | null;
  mockup: string | null;
  title: string;
  alt: string;
}) {
  const image = mockup ?? cover;

  if (!image) {
    return (
      <div className="mx-auto flex aspect-3/4 w-64 items-center justify-center bg-cream-2 px-8">
        <span className="text-center font-serif text-h3 text-ink">{title}</span>
      </div>
    );
  }

  return (
    <figure className="relative mx-auto w-full max-w-[29rem]">
      {/* צל קרקע: תאורת סביבה מתחת למשטח, לא חלק מציור הכריכה עצמה */}
      <div
        aria-hidden="true"
        className="absolute bottom-[3%] left-1/2 h-[12%] w-[78%] -translate-x-1/2 rounded-full bg-navy/25 blur-2xl"
      />

      <div className="relative aspect-4/5">
        <Image
          src={image}
          alt={alt}
          fill
          priority
          fetchPriority="high"
          sizes="(max-width: 768px) 78vw, (max-width: 1200px) 42vw, 460px"
          className="object-contain drop-shadow-[0_35px_38px_rgba(11,21,32,0.22)]"
        />
      </div>
    </figure>
  );
}
