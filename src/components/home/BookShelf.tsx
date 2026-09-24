'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Img as Image } from '@/components/Img';
import { usePlaceholderArt } from '@/components/placeholder-art-context';
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
 * הספר הפתוח אינו נסגר לבד: לא כשהעכבר עוזב את המדף, לא כשהאצבע
 * מורמת, ולא כשהמיקוד עובר משם. הוא נשאר פתוח עד שספר אחר נפתח
 * במקומו (הצבעה/מיקוד/החלקה על ספר אחר) — כך שהמדף לא "נסגר" מתחת
 * לעין ברגע שהעכבר יוצא ממנו, מה שהיה גורם לו להיראות ריק ברוב הזמן.
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
      // [1.30] המדף הוגדל בכ-30% מהפרופורציות הקודמות — בכל מקום שבו יש
      // לכך רוחב מסך: טלפון צר (<xs) נשאר במידות הקודמות כי עשרה ספרים
      // כבר ממלאים בו את הרוחב עד הקצה (גלישה אופקית היא כשל נגישות);
      // מ-xs מוחלות מידות הבסיס ×1.3, מ-sm המידות הגדולות הקודמות (שכבר
      // ממלאות את הרוחב עד ~lg), ומ-lg המידות הגדולות ×1.3.
      className="mx-auto max-w-full px-4 [--bw:1.5rem] [--gp:0px] [--ow:6.5rem] xs:[--bw:1.95rem] xs:[--ow:8.45rem] sm:[--bw:2.75rem] sm:[--ow:11rem] lg:[--bw:3.575rem] lg:[--ow:14.3rem]"
    >
      {/* רוחב המדף שמור מראש לרוחב שכל הספרים תופסים כשאחד מהם פתוח.
          בלי ההזמנה הזו לוח המדף היה מתרחב ומתכווץ בכל מעבר עכבר, וכל
          מה שמתחתיו היה קופץ איתו. */}
      <div className="mx-auto w-[min(100%,calc(var(--shelf-n)*var(--bw)+(var(--shelf-n)-1)*var(--gp)+var(--ow)-var(--bw)))]">
        <ul ref={shelfRef} className="flex items-end justify-center gap-[var(--gp)]">
          {books.map((book, index) => (
            <BookOnShelf
              key={book.slug}
              book={book}
              index={index}
              open={active === index}
              onEnter={() => focusBook(index)}
              onFocus={() => focusBook(index)}
            />
          ))}
        </ul>

        {/* לוח המדף: קו זהב וזוהר חם מתחתיו — לא קו כהה. הרצועה שמסביב
            כהה בגווני הלוגו (ראו page.tsx), וקו בגוון ה-rule הרגיל היה
            נבלע בה; זהב הוא כבר הגוון שמייצג "עץ" בשדרת ספר בלי צילום. */}
        <div aria-hidden="true">
          <div className="h-[3px] rounded-full bg-gradient-to-l from-transparent via-gold/80 to-transparent" />
          <div className="mx-auto h-6 w-[92%] bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--color-gold)_20%,transparent),transparent_70%)]" />
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
}: {
  book: ShelfBook;
  index: number;
  open: boolean;
  onEnter: () => void;
  onFocus: () => void;
}) {
  const { coverUrl: baseCoverUrl } = usePlaceholderArt();

  // גובה משתנה קלות לפי המיקום — ספרים אמיתיים על מדף אינם באותו גובה
  // בדיוק. נגזר מהאינדקס ולא מ-random, כדי שהשרת והלקוח יסכימו.
  // [1.30] מדרגות הגובה עוקבות אחרי מדרגות הרוחב שעל המדף (ראו למעלה):
  // בסיס — כמו קודם; xs — בסיס ×1.3; sm — המידות הגדולות הקודמות;
  // lg — המידות הגדולות ×1.3. כך הפרופורציות נשמרות בכל מדרגה.
  const heights = [
    'h-[11rem] xs:h-[14.3rem] sm:h-[15rem] lg:h-[19.5rem]',
    'h-[12rem] xs:h-[15.6rem] sm:h-[16.5rem] lg:h-[21.45rem]',
    'h-[11.5rem] xs:h-[14.95rem] sm:h-[15.75rem] lg:h-[20.5rem]',
    'h-[12.5rem] xs:h-[16.25rem] sm:h-[17rem] lg:h-[22.1rem]',
    'h-[11.75rem] xs:h-[15.3rem] sm:h-[16rem] lg:h-[20.8rem]',
  ];
  const height = heights[index % heights.length];

  return (
    <li
      data-shelf-index={index}
      onMouseEnter={onEnter}
      // --bw/--ow מוגדרים על המדף (ראו למעלה) ומכוילים כך שעשרה ספרים,
      // אחד מהם פתוח, נכנסים לרוחב מסך טלפון בלי לגלוש — גלישה אופקית
      // היא כשל נגישות, לא רק חוסר נוחות.
      /*
       * ‏[1.41] רוחב הספר הסגור נגזר מהשדרה עצמה, לא ממשבצת בגודל קבוע.
       *
       * עד כה כל ספר קיבל ‎w-[var(--bw)] זהה, והשדרה נמתחה למלא אותו
       * ‏(object-cover). מי שמעלה צילום שדרה צר — וכל השדרות מועלות על
       * רקע שקוף — קיבל את הרקע השקוף כרווח גלוי בין הספרים, והמדף
       * נראה מפוזר ולא צמוד.
       *
       * ‏w-auto עם ‎max-w-[var(--bw)]: הרוחב בא מיחס הצדדים של הקובץ
       * בגובה המדף, אבל לא יותר מהמשבצת המקורית. הסייג הזה הוא מה
       * ששומר על ההבטחה שעשרה ספרים נכנסים לרוחב טלפון בלי גלישה
       * אופקית — הרוחב השמור למדף (החישוב למעלה) נשאר חסם עליון תקף.
       *
       * שדרה שנבנית מצבעי הכריכה (בלי צילום) נשארת ברוחב הקבוע: היא
       * סינתטית, ורוחב אחיד הוא הנכון לה.
       */
      className={`${height} shrink-0 transition-[width] duration-500 ease-[var(--ease-spring)] motion-reduce:transition-none ${
        open
          ? 'w-[var(--ow)]'
          : book.spineUrl
            ? 'w-auto max-w-[var(--bw)]'
            : 'w-[var(--bw)]'
      }`}
    >
      <Link
        href={`/books/${book.slug}`}
        onFocus={onFocus}
        aria-label={book.author ? `${book.title} — ${book.author}` : book.title}
        className={`relative block h-full w-full overflow-hidden rounded-[3px] shadow-[var(--shadow-soft)] transition-[transform,box-shadow] duration-500 ease-[var(--ease-spring)] focus-visible:outline-offset-4 motion-reduce:transition-none ${
          open ? 'shadow-[var(--shadow-lift)] -translate-y-3' : ''
        }`}
      >
        {/*
          השדרה — גלויה כשהספר סגור.

          ‏[1.41] כששדרה צולמה, השכבה הזו **בזרימה** ולא absolute: היא
          מה שמקנה ל-<li> את רוחבו (ראו ההערה למעלה), ואלמנט מחוץ
          לזרימה אינו תורם רוחב לאב. כשהספר פתוח הרוחב נקבע מ---ow
          והשדרה רק דוהה, ולכן אז אין הבדל.

          שדרה סינתטית נשארת absolute: הרוחב שלה קבוע מלכתחילה.
        */}
        <span
          aria-hidden={open}
          className={`transition-opacity duration-300 ${
            book.spineUrl ? 'block h-full w-auto max-w-full' : 'absolute inset-0'
          } ${open ? 'opacity-0' : 'opacity-100'}`}
        >
          <Spine book={book} fit={book.spineUrl ? 'intrinsic' : 'cover'} />
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
              sizes="280px"
              quality={90}
              className="object-cover"
            />
          ) : baseCoverUrl ? (
            /* [1.12] חזית מבוססת תמונת הבסיס — שם הספר בזהב בתוך הקשת */
            <span className="relative flex h-full w-full items-center justify-center overflow-hidden">
              <Image src={baseCoverUrl} alt="" fill sizes="280px" quality={90} className="object-cover" />
              <span
                className="relative line-clamp-4 px-[18%] text-center font-bold leading-snug text-gold-bright"
                style={{
                  fontFamily: "var(--font-david-libre), 'David Libre', serif",
                  fontSize: '0.8rem',
                  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                }}
              >
                {book.title}
              </span>
            </span>
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-navy px-2 text-center font-serif text-caption text-cream">
              {book.title}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

/**
 * השדרה. צילום אמיתי אם הועלה, ואחרת שדרה שנבנית מצבעי הכריכה: גוף
 * בצבע הספר, קווי זהב והשם מוטבעים בשליש העליון — כמו תווית מוטבעת
 * ליד ראש שדרת ספר אמיתי, לא לכל האורך. writing-mode אנכי ולא rotate —
 * כך הטקסט נשאר טקסט אמיתי שנבחר, נקרא בקורא מסך ומתפצל לשורות אם צריך.
 *
 * [1.13] בלי שכבת ברק/טשטוש מעל התמונה — התמונה (שצולמה או תמונת
 * הבסיס) מוצגת נקייה; רק צל טקסט עדין שומר על קריאות הכיתוב.
 */
/**
 * [1.39] מיוצא: מדף הסדרה בעמוד הספר (SeriesShelfClient) משתמש באותה
 * שדרה בדיוק — כך הסדרה "עומדת" כמו על מדף עמוד הבית, לא כמו רכיב זר.
 */
export function Spine({
  book,
  fit = 'cover',
}: {
  book: ShelfBook;
  /**
   * ‏[1.41] איך צילום שדרה מתמלא בקופסה שלו.
   *
   *   'cover'     — התנהגות המקור: fill + object-cover, למי שקובע את
   *                 רוחב הקופסה בעצמו (מדף הסדרה בעמוד הספר).
   *   'intrinsic' — הקופסה מקבלת את רוחבה מיחס הצדדים של הצילום
   *                 בגובה הנתון. זה מה שמאפשר לשדרות במדף עמוד הבית
   *                 לעמוד צמודות זו לזו במקום בתוך משבצות אחידות.
   */
  fit?: 'cover' | 'intrinsic';
}) {
  const { spineUrl: baseSpineUrl } = usePlaceholderArt();

  if (book.spineUrl && fit === 'intrinsic') {
    /*
     * ‏h-full w-auto: הרוחב נגזר מיחס הצדדים של הקובץ, ולכן אין ריפוד
     * שקוף בצדדים ואין מתיחה. ‏max-w-full + object-cover מטפלים במקרה
     * ההפוך — צילום רחב מהמשבצת נחתך במקום למתוח את הקופסה מעבר לחסם.
     *
     * width/height כאן הם יחס *ההערכה* בלבד, למניעת קפיצת פריסה לפני
     * הטעינה (המשבצת בפועל היא ~1:5.7). אחרי הטעינה הדפדפן מחשב את
     * הרוחב מיחס הצדדים האמיתי של הקובץ.
     */
    return (
      <Image
        src={book.spineUrl}
        alt=""
        width={280}
        height={1600}
        quality={90}
        className="h-full w-auto max-w-full object-cover"
      />
    );
  }

  if (book.spineUrl) {
    // [1.14] sizes מכוון לרוחב בלבד היה גורם ל-next/image להוריד תמונה
    // קטנה גם בגובה (יחס-רוחב-גובה של המקור), ו-object-cover על תיבה
    // צרה וגבוהה כל-כך נאלץ אז למתוח אותה כלפי מעלה — זו הייתה סיבת
    // ה"טשטוש": לא שכבה עיצובית אלא הגדלה (upscale) של תמונה קטנה מדי.
    // sizes נדיב יותר, קרוב לגובה המדף בפועל, מבטיח רזולוציה מספקת.
    return <Image src={book.spineUrl} alt="" fill sizes="280px" quality={90} className="object-cover" />;
  }

  // [1.12] שדרת בסיס מההגדרות: תמונת שדרת העור הגנרית, ושם הספר מוטבע
  // בשליש העליון-אמצעי בזהב ובגופן תורני — במקום השדרה הצבעונית הנגזרת
  // מהכריכה. [1.14] הכיתוב יורד מעט מקצה השדרה ומשתרע עד גבול שני-
  // השליש העליונים (לא נכנס לשליש התחתון).
  if (baseSpineUrl) {
    return (
      <span className="relative block h-full w-full overflow-hidden">
        <Image src={baseSpineUrl} alt="" fill sizes="280px" quality={90} className="object-cover" />
        {/* [1.29] top-[20%] ולא margin-top: אחוז ב-margin (וב-padding) נגזר
            תמיד לפי הרוחב של הקופסה המכילה, לא הגובה שלה — גם כשהצאצא
            עצמו במצב column. בקופסה צרה וגבוהה כמו שדרה (רוחב ~2-3rem,
            גובה ~12-17rem) 20% רוחב הם רק כמה פיקסלים, כך שהכיתוב נשאר
            כמעט בקצה העליון ממש בפועל. position:absolute + top:% כן
            נגזר לפי גובה הקופסה הממוקמת (positioned ancestor) — זו הדרך
            הנכונה למקם "20% מהגובה" ב-CSS. */}
        <span className="absolute inset-x-0 top-[20%] flex max-h-[45%] flex-col items-center gap-1">
          <span aria-hidden="true" className="h-px w-[70%] shrink-0 bg-gold/70" />
          <span
            className="overflow-hidden text-ellipsis whitespace-nowrap [writing-mode:vertical-rl] rotate-180 text-[0.6875rem] font-bold leading-none text-gold-bright"
            style={{
              fontFamily: "var(--font-david-libre), 'David Libre', serif",
              textShadow: '0 1px 2px rgba(0,0,0,0.8)',
            }}
          >
            {book.title}
          </span>
          <span aria-hidden="true" className="h-px w-[70%] shrink-0 bg-gold/70" />
        </span>
      </span>
    );
  }

  return (
    <span
      className="relative block h-full w-full overflow-hidden"
      style={{
        background: `linear-gradient(to left, ${book.spineEdge} 0%, ${book.spineBase} 22%, ${book.spineBase} 78%, ${book.spineEdge} 100%)`,
      }}
    >
      {/* [1.29] top-[20%] ולא margin-top: ראו ההסבר בענף baseSpineUrl למעלה — אחוז ב-margin נגזר לפי הרוחב, לא הגובה. */}
      <span className="absolute inset-x-0 top-[20%] flex max-h-[45%] flex-col items-center gap-1">
        <span aria-hidden="true" className="h-px w-[62%] shrink-0 bg-gold/55" />
        <span className="overflow-hidden text-ellipsis whitespace-nowrap [writing-mode:vertical-rl] rotate-180 font-serif text-[0.6875rem] leading-none text-gold-bright/90">
          {book.title}
        </span>
        <span aria-hidden="true" className="h-px w-[62%] shrink-0 bg-gold/55" />
      </span>
    </span>
  );
}
