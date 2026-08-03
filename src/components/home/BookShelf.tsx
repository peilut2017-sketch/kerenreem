'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Img as Image } from '@/components/Img';
import { Link } from '@/i18n/navigation';

export interface ShelfBook {
  slug: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  coverAlt: string;
  /** צילום שדרה שהועלה בניהול. ריק = השדרה נבנית מהצבעים שלמטה. */
  spineUrl: string | null;
  spineBase: string;
  spineEdge: string;
}

/**
 * מדף הספרים בראש עמוד הבית.
 *
 * הספרים עומדים על המדף ומראים את שדרתם. הספר שמצביעים עליו נפתח אל
 * חזית הכריכה ודוחף את שכניו הצדה — הרוחב שלו הוא שגדל, והשאר נדחקים
 * מעצמם מפני שזו שורת flex אחת. זו הסיבה שהאפקט אינו זקוק לחישובי
 * תלת-ממד: התנועה אמיתית ולא מדומה, ולכן היא נכונה גם ב-RTL וגם כשגודל
 * הגופן משתנה מסרגל הנגישות.
 *
 * במגע אין hover: החלקת אצבע לאורך המדף פותחת את הספר שמתחתיה
 * (elementFromPoint על כל touchmove), כך שאפשר "לדפדף" במדף בתנועה
 * אחת — ולא רק להקיש ספר-ספר.
 *
 * ספר בלי שדרה שצולמה מקבל שדרה שנבנית מצבעי הכריכה שלו (ראו
 * getSpineLook ב-cover-colors.ts) עם שמו מוטבע לאורכה. כך המדף מלא
 * מהיום הראשון, ולא מחכה שיצולמו שדרות לכל הקטלוג.
 */
export function BookShelf({ books, label }: { books: ShelfBook[]; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const shelfRef = useRef<HTMLUListElement>(null);

  // מגע: הספר שמתחת לאצבע נפתח תוך כדי החלקה. הרישום ידני ולא דרך
  // onTouchMove של React כדי שאפשר יהיה לרשום passive:false ולעצור
  // גלילה אופקית של העמוד בזמן החלקה על המדף עצמו.
  useEffect(() => {
    const shelf = shelfRef.current;
    if (!shelf) return;

    // הספר הקרוב ביותר לאצבע, ולא הספר שהאצבע *בתוכו*.
    //
    // ההבדל מהותי: הספר הפתוח רחב פי ארבעה מספר סגור, ולכן ברגע שנפתח
    // הוא משתרע על כל טווח ההחלקה הבא ו"בולע" אותה — נמדד, האצבע נתקעה
    // על אותו ספר לכל אורך המדף. מרחק ממרכזים מחזיר מעבר רציף: השכן
    // נעשה הקרוב ביותר עוד לפני שהאצבע יצאה מהספר הפתוח.
    const nearestIndex = (x: number, y: number) => {
      let best: number | null = null;
      let bestDistance = Infinity;

      for (const item of shelf.querySelectorAll('[data-shelf-index]')) {
        const rect = item.getBoundingClientRect();
        // מרווח סובלנות אנכי, כדי שהאצבע לא תאבד את המדף בסטייה קלה
        if (y < rect.top - 48 || y > rect.bottom + 48) continue;

        const distance = Math.abs(x - (rect.left + rect.width / 2));
        if (distance < bestDistance) {
          bestDistance = distance;
          best = Number(item.getAttribute('data-shelf-index'));
        }
      }
      return best;
    };

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      const index = nearestIndex(touch.clientX, touch.clientY);
      if (index !== null) {
        event.preventDefault();
        setActive(index);
      }
    };

    shelf.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => shelf.removeEventListener('touchmove', onTouchMove);
  }, []);

  // מקלדת: מיקוד על ספר פותח אותו, כמו הצבעה. בלי זה המדף קיים
  // למשתמש מקלדת רק כרשימת קישורים בלי שום משוב חזותי.
  const focusBook = useCallback((index: number | null) => setActive(index), []);

  if (books.length === 0) return null;

  return (
    <section
      aria-label={label}
      // מידות הספרים חיות כאן כמשתני CSS, ולא כמחלקות על כל ספר בנפרד,
      // כדי שרוחב המדף יחושב מהן ישירות בשורה למטה.
      style={{ '--shelf-n': books.length } as React.CSSProperties}
      className="mx-auto max-w-full px-4 [--bw:1.5rem] [--gp:2px] [--ow:6.5rem] sm:[--bw:2.75rem] sm:[--gp:6px] sm:[--ow:11rem]"
    >
      {/* רוחב המדף שמור מראש לרוחב שכל הספרים תופסים כשאחד מהם פתוח.
          בלי ההזמנה הזו לוח המדף היה מתרחב ומתכווץ בכל מעבר עכבר, וכל
          מה שמתחתיו היה קופץ איתו. */}
      <div className="mx-auto w-[min(100%,calc(var(--shelf-n)*var(--bw)+(var(--shelf-n)-1)*var(--gp)+var(--ow)-var(--bw)))]">
        <ul
          ref={shelfRef}
          onMouseLeave={() => setActive(null)}
          onTouchEnd={() => setActive(null)}
          className="flex items-end justify-center gap-[var(--gp)]"
        >
          {books.map((book, index) => (
            <BookOnShelf
              key={book.slug}
              book={book}
              index={index}
              open={active === index}
              onEnter={() => focusBook(index)}
              onFocus={() => focusBook(index)}
              onBlur={() => focusBook(null)}
            />
          ))}
        </ul>

        {/* לוח המדף: קו אופקי וצל רך שמניח עליו את הספרים */}
        <div aria-hidden="true">
          <div className="h-[3px] rounded-full bg-gradient-to-l from-transparent via-rule-strong to-transparent" />
          <div className="mx-auto h-6 w-[92%] bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--color-ink)_16%,transparent),transparent_70%)]" />
        </div>
      </div>
    </section>
  );
}

function BookOnShelf({
  book,
  index,
  open,
  onEnter,
  onFocus,
  onBlur,
}: {
  book: ShelfBook;
  index: number;
  open: boolean;
  onEnter: () => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  // גובה משתנה קלות לפי המיקום — ספרים אמיתיים על מדף אינם באותו גובה
  // בדיוק. נגזר מהאינדקס ולא מ-random, כדי שהשרת והלקוח יסכימו.
  const heights = [
    'h-[11rem] sm:h-[15rem]',
    'h-[12rem] sm:h-[16.5rem]',
    'h-[11.5rem] sm:h-[15.75rem]',
    'h-[12.5rem] sm:h-[17rem]',
    'h-[11.75rem] sm:h-[16rem]',
  ];
  const height = heights[index % heights.length];

  return (
    <li
      data-shelf-index={index}
      onMouseEnter={onEnter}
      // --bw/--ow מוגדרים על המדף (ראו למעלה) ומכוילים כך שעשרה ספרים,
      // אחד מהם פתוח, נכנסים לרוחב מסך טלפון בלי לגלוש — גלישה אופקית
      // היא כשל נגישות, לא רק חוסר נוחות.
      className={`${height} shrink-0 transition-[width] duration-500 ease-[var(--ease-spring)] motion-reduce:transition-none ${
        open ? 'w-[var(--ow)]' : 'w-[var(--bw)]'
      }`}
    >
      <Link
        href={`/books/${book.slug}`}
        onFocus={onFocus}
        onBlur={onBlur}
        aria-label={book.author ? `${book.title} — ${book.author}` : book.title}
        className={`relative block h-full w-full overflow-hidden rounded-[3px] shadow-[var(--shadow-soft)] transition-[transform,box-shadow] duration-500 ease-[var(--ease-spring)] focus-visible:outline-offset-4 motion-reduce:transition-none ${
          open ? 'shadow-[var(--shadow-lift)] -translate-y-3' : ''
        }`}
      >
        {/* השדרה — גלויה כשהספר סגור */}
        <span
          aria-hidden={open}
          className={`absolute inset-0 transition-opacity duration-300 ${
            open ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <Spine book={book} />
        </span>

        {/* החזית — נגלית כשהספר נפתח */}
        <span
          aria-hidden={!open}
          className={`absolute inset-0 transition-opacity duration-500 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {book.coverUrl ? (
            <Image
              src={book.coverUrl}
              alt={book.coverAlt}
              fill
              sizes="176px"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-navy px-2 text-center font-serif text-caption text-cream">
              {book.title}
            </span>
          )}

          {/* ברק אלכסוני — על החזית בלבד.
              קודם הוא ישב מעל שתי הפאות, וזו הייתה טעות: על שדרה ברוחב
              44px פס האור תופס חלק ניכר מהרוחב, וכל השדרה נראתה מטושטשת
              ושטופה במקום מבריקה. על החזית הרחבה אותו פס נקרא כברק על
              נייר, וזו הכוונה המקורית. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_35%,color-mix(in_srgb,#fff_22%,transparent)_50%,transparent_62%)]"
          />
        </span>
      </Link>
    </li>
  );
}

/**
 * השדרה. צילום אמיתי אם הועלה, ואחרת שדרה שנבנית מצבעי הכריכה: גוף
 * בצבע הספר, קווי זהב למעלה ולמטה כמו על כריכה אמיתית, והשם מוטבע
 * לאורך. writing-mode אנכי ולא rotate — כך הטקסט נשאר טקסט אמיתי
 * שנבחר, נקרא בקורא מסך ומתפצל לשורות אם צריך.
 */
function Spine({ book }: { book: ShelfBook }) {
  if (book.spineUrl) {
    return <Image src={book.spineUrl} alt="" fill sizes="44px" className="object-cover" />;
  }

  return (
    <span
      className="flex h-full w-full flex-col items-center justify-between py-2.5"
      style={{
        background: `linear-gradient(to left, ${book.spineEdge} 0%, ${book.spineBase} 22%, ${book.spineBase} 78%, ${book.spineEdge} 100%)`,
      }}
    >
      <span aria-hidden="true" className="h-px w-[62%] bg-gold/55" />
      <span
        className="[writing-mode:vertical-rl] max-h-[78%] overflow-hidden text-ellipsis whitespace-nowrap rotate-180 font-serif text-[0.6875rem] leading-none text-gold-bright/90"
      >
        {book.title}
      </span>
      <span aria-hidden="true" className="h-px w-[62%] bg-gold/55" />
    </span>
  );
}
