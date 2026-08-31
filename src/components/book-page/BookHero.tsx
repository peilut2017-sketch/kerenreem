import { Reveal } from '@/components/Reveal';
import { BookCoverStage } from './BookCoverStage';
import { HeroBackground } from './HeroBackground';
import { HeroSpecStrip } from './HeroSpecStrip';
import { SmartTag } from './SmartTag';
import { localized } from '@/lib/localized';
import type { AuthorDisplay } from '@/lib/books/author-display';
import type { BookWithRelations } from '@/lib/supabase/types';
import type { CoverPalette } from '@/lib/cover-colors';

/**
 * Hero של עמוד הספר: הכרך העומד בקצה ההתחלה (ימין בעברית), התוכן לצדו.
 *
 * לא מרכוז. גרסה קודמת מרכזה את הטקסט והשאירה כשליש מסך ריק; קריאה
 * מתחילה מקצה קבוע, וכותרת שמתחילה באמצע גורמת לעין לחפש את ההתחלה
 * בכל שורה. שתי העמודות צמודות זו לזו במקום להידחף לקצוות ההפוכים,
 * כך שהכריכה והשם נקראים כיחידה אחת.
 *
 * המידע מדורג בכוונה: תג → שם → משפט אחד → מפרט קצר (כולל מחבר, מקושר
 * לעמודו) → פעולה. שם המחבר מופיע פעם אחת בלבד — בסרגל המפרט, לא גם
 * מתחת לכותרת — כדי לא לחזור על אותו מידע פעמיים ברצף.
 * כל שורה עונה על שאלה אחת, ומי שמצא את מבוקשו יכול לעצור.
 *
 * הכריכה ראשונה גם ב-DOM וגם חזותית — בלי order-* שמפריד בין מה שרואים
 * לבין מה שקורא מסך עובר עליו. בנייד זה נותן כריכה למעלה וטקסט מתחתיה,
 * שזה ממילא הסדר הנכון שם.
 */
export function BookHero({
  book,
  palette,
  title,
  subtitle,
  author,
  categoryName,
  year,
  badges = [],
  actions,
  t,
  locale = 'he',
}: {
  book: BookWithRelations;
  palette: CoverPalette;
  title: string;
  subtitle: string | null;
  /** שם המחבר להצגה וקישור לעמודו — null לטקסט חופשי, ראו lib/books/author-display.ts */
  author: AuthorDisplay | null;
  categoryName: string | null;
  year: string;
  /** תגי סטטוס (בקרוב / בחירת המכון) — עד שניים, קודמים לתג המהדורה. */
  badges?: string[];
  /** גוש המחיר והפעולות — מוזרק מהעמוד כדי ש-Hero לא יכיר את מצב החנות */
  actions?: React.ReactNode;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  locale?: string;
}) {
  // [1.9] שם המחבר מוצג פעם אחת בלבד — כאן בסרגל, עם קישור לעמודו כשקיים
  // (author.href הוא null לטקסט חופשי, ראו lib/books/author-display.ts).
  // הוסר מתחת לכותרת כדי לא לחזור על אותו מידע פעמיים ברצף.
  const specs = [
    author ? { label: t('author'), value: author.name, href: author.href ?? undefined } : null,
    categoryName ? { label: t('category'), value: categoryName } : null,
    year ? { label: t('publicationYear'), value: year } : null,
    book.pages ? { label: t('pages'), value: String(book.pages) } : null,
  ].filter((item): item is { label: string; value: string; href?: string } => item !== null);

  // תג המהדורה: קטגוריה + שנה עברית, לא טענה מומצאת ("מהדורה מבוארת")
  // שאין לה מקור נתונים אמיתי בכל ספר.
  const editionBadge = [categoryName, book.publication_year_he].filter(Boolean).join(' · ');

  return (
    // מעטפת רחבה עם שוליים מהקצה, כדי שה-Hero יהיה כרטיס עומד בפני עצמו
    // (border-radius 32px, overflow hidden) ולא רצועה צמודה לקצוות המסך —
    // זה ההבדל החזותי הראשון שאומר "שולחן עיון", לא "עמוד תוכן" (סעיף 8).
    <div className="px-4 pt-5 sm:px-6 lg:px-10 lg:pt-8 xl:px-14">
      <section
        id="book-hero"
        className="relative mx-auto max-w-[92rem] overflow-hidden rounded-[2rem] lg:min-h-[45rem] lg:rounded-[2.5rem]"
      >
        <HeroBackground colors={palette.colors} />

        <div className="relative mx-auto flex w-full max-w-[92rem] items-center px-6 pb-16 pt-14 sm:px-10 lg:min-h-[45rem] lg:px-16 lg:pb-24 lg:pt-20">
          <div className="grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-[5fr_7fr] lg:gap-16 xl:gap-20">
            <BookCoverStage
              cover={book.cover_image_url}
              mockup={book.hero_mockup_url}
              title={title}
              /* הטקסט החלופי שהעורך כתב (cover_alt) קודם לגזירה האוטומטית —
                 עד עכשיו השדה נשמר ונוקד במד ההשלמה אך מעולם לא הגיע ל-DOM */
              alt={book.cover_alt || t('coverAlt', { title })}
            />

            <div className="text-center lg:text-start">
              {/* עד שני תגים ראשיים בלבד (סעיף 8 במפרט): תגי סטטוס (בקרוב /
                  בחירת המכון) קודמים, ותג המהדורה (קטגוריה + שנה) מוצג רק
                  כשאין תג סטטוס — כדי שלא נחרוג משניים. */}
              {badges.length > 0 ? (
                <Reveal className="mb-4 flex flex-wrap justify-center gap-2 lg:justify-start">
                  {badges.slice(0, 2).map((badge) => (
                    <span
                      key={badge}
                      className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-gold-deep/40 bg-cream/80 px-3.5 py-1.5 text-caption text-gold-deep"
                    >
                      {badge}
                    </span>
                  ))}
                </Reveal>
              ) : editionBadge ? (
                <Reveal
                  as="span"
                  className="mb-4 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-rule bg-cream/80 px-3.5 py-1.5 text-caption text-muted"
                >
                  {editionBadge}
                </Reveal>
              ) : null}

              {book.tags && book.tags.length > 0 ? (
                <Reveal className="mb-5 flex flex-wrap justify-center gap-2 lg:justify-start">
                  {book.tags.slice(0, 3).map((tag) => (
                    <SmartTag
                      key={tag.id}
                      /* שם התגית לפי השפה — לתגית יש name_en בסכימה;
                         ההסבר (description) עברי-בלבד בסכימה */
                      label={localized(tag, 'name', locale)}
                      slug={tag.slug}
                      description={tag.description_he}
                    />
                  ))}
                </Reveal>
              ) : null}

              <Reveal as="h1" className="font-serif text-[clamp(2.75rem,5.2vw,4.75rem)] leading-[1.03] text-ink">
                {title}
              </Reveal>

              {subtitle ? (
                <Reveal delay={150} as="p" className="mx-auto mt-4 max-w-xl text-lead text-muted lg:mx-0">
                  {subtitle}
                </Reveal>
              ) : null}

              {specs.length > 0 ? (
                <Reveal delay={220} className="mt-7">
                  <HeroSpecStrip items={specs} />
                </Reveal>
              ) : null}

              {actions ? (
                <Reveal id="book-purchase" delay={290} className="mt-7">
                  {actions}
                </Reveal>
              ) : null}

              {/* מונה הצפיות הוסר מה-Hero במכוון: הוא נתון על *העמוד*, לא על
                  הספר, ואין לו מה לעשות בין שם המחבר למחיר. ה-Hero נשאר
                  מרווח — תג אחד, שם, מחבר, כותרת משנה, עד ארבעה נתונים
                  ופעולה. */}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
