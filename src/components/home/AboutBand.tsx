import { Img as Image } from '@/components/Img';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Ornament } from '../Ornament';
import { Reveal } from '../Reveal';

/**
 * רצועת האודות: הצילום פרוש על רוחב המקטע, והטקסט יושב עליו.
 *
 * הטקסט מוגבל לכמה שורות בכוונה — זהו פתח לעמוד האודות ולא תחליף לו.
 * כשאין צילום, הטקסט תופס את מלוא הרוחב במקום להשאיר חצי עמוד ריק.
 *
 * ‏[1.41] שלוש דרישות, וכל אחת מהן שוללת פתרון מתבקש אחר:
 *
 *  1. **הצילום אינו נחתך.** לכן ‎<img> בזרימה עם ‎w-full h-auto ולא
 *     ‎fill + object-cover. הגובה נגזר מיחס הצדדים של הקובץ, ולכן אין
 *     חיתוך — לא למעלה, לא בצדדים.
 *  2. **הוא פרוש על רוחב המקטע**, בתוך המסגרת. לכן הוא אינו עוד עמודה
 *     בגריד של שתיים אלא רקע הכרטיס כולו.
 *  3. **באזור הטקסט הוא בהיר יותר**, כדי שיקרא כרקע לטקסט ולא כתמונה
 *     שמישהו כתב עליה.
 *
 * איך שלושתן מתקיימות יחד: הצילום והטקסט יושבים **באותו תא גריד**
 * (שניהם row-start-1 ב-lg). גובה התא הוא המקסימום בין השניים, ולכן:
 *   • צילום גבוה מהטקסט — הטקסט מרוכז עליו.
 *   • טקסט גבוה מהצילום (קובץ רחב ונמוך, יחס 3:1) — התא נמתח לפי
 *     הטקסט, הצילום נשאר בראש ואינו נמתח, והרקע מתחתיו הוא הקרם של
 *     הכרטיס. לא חיתוך ולא טקסט שנשפך.
 *
 * במסך צר הטקסט יורד **מתחת** לצילום ולא עליו: על רוחב טלפון אפילו
 * ‏overlay בהיר הופך פסקה שלמה לקשה לקריאה, וזה לא שיפור.
 *
 * ההבהרה עצמה היא .about-band-wash (globals.css) — מדורגת כך שהצילום
 * נשאר נראה בקצוות ובהיר במרכז, שם הטקסט. במצב ניגודיות גבוהה היא
 * הופכת אטומה לגמרי; שם אין להסתמך על שקיפות מעל צילום שרירותי.
 */
export async function AboutBand({
  excerpt,
  imageUrl,
}: {
  excerpt: string;
  imageUrl: string | null;
}) {
  const t = await getTranslations();

  return (
    <section className="py-16 lg:py-20">
      <div className="mx-auto w-full max-w-[82rem] px-5 sm:px-8">
        <div className="card overflow-hidden">
          <div className={imageUrl ? 'grid' : undefined}>
            {imageUrl ? (
              // ‏self-start: כשהטקסט גבוה מהצילום, הצילום נשאר בראש
              // התא במקום להימתח ולעוות את יחס הצדדים.
              <div className="col-start-1 row-start-1 self-start">
                <Image
                  src={imageUrl}
                  alt=""
                  width={1600}
                  height={900}
                  sizes="(max-width: 88rem) 100vw, 82rem"
                  className="h-auto w-full"
                />
              </div>
            ) : null}

            <Reveal
              as="div"
              className={`col-start-1 flex flex-col items-center justify-center px-6 py-16 text-center sm:px-12 lg:py-24 ${
                imageUrl ? 'about-band-wash row-start-2 lg:row-start-1' : ''
              }`}
            >
              <p className="eyebrow">{t('home.aboutLead')}</p>
              <h2 className="mt-3 font-display text-[clamp(1.625rem,3.4vw,2.25rem)] text-ink">
                {t('home.aboutTitle')}
              </h2>
              <Ornament />

              <p className="mt-7 max-w-[52ch] text-body leading-[1.9] text-ink-soft">{excerpt}</p>

              <p className="mt-8">
                <Link href="/about" className="link-more">
                  {t('home.aboutMore')}
                </Link>
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
