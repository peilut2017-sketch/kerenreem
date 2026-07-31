import { Link } from '@/i18n/navigation';
import { Reveal } from '@/components/Reveal';
import { FloatingCover } from './FloatingCover';
import { HeroBackground } from './HeroBackground';
import { HeroSpecStrip } from './HeroSpecStrip';
import { SmartTag } from './SmartTag';
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
 * המידע מדורג בכוונה: תג → שם → מחבר → משפט אחד → מפרט קצר → פעולה.
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
  authorName,
  categoryName,
  year,
  actions,
  t,
}: {
  book: BookWithRelations;
  palette: CoverPalette;
  title: string;
  subtitle: string | null;
  authorName: string | null;
  categoryName: string | null;
  year: string;
  /** גוש המחיר והפעולות — מוזרק מהעמוד כדי ש-Hero לא יכיר את מצב החנות */
  actions?: React.ReactNode;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  const specs = [
    authorName ? { label: t('author'), value: authorName } : null,
    categoryName ? { label: t('category'), value: categoryName } : null,
    year ? { label: t('publicationYear'), value: year } : null,
    book.pages ? { label: t('pages'), value: String(book.pages) } : null,
  ].filter((item): item is { label: string; value: string } => item !== null);

  return (
    <section id="book-hero" className="relative overflow-hidden">
      <HeroBackground colors={palette.colors} />

      <div className="relative mx-auto w-full max-w-[72rem] px-5 pb-16 pt-10 sm:px-8 lg:pb-20 lg:pt-14">
        <div className="grid items-center gap-10 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-14">
          <FloatingCover src={book.cover_image_url} title={title} alt={t('coverAlt', { title })} />

          <div className="text-center lg:text-start">
            {book.tags && book.tags.length > 0 ? (
              <Reveal className="mb-5 flex flex-wrap justify-center gap-2 lg:justify-start">
                {book.tags.slice(0, 3).map((tag) => (
                  <SmartTag key={tag.id} label={tag.name_he} slug={tag.slug} description={tag.description_he} />
                ))}
              </Reveal>
            ) : null}

            <Reveal as="h1" className="font-serif text-[clamp(2.25rem,4.4vw,3.4rem)] leading-[1.08] text-ink">
              {title}
            </Reveal>

            {authorName ? (
              <Reveal delay={90} as="p" className="mt-2 font-serif text-[clamp(1.2rem,1.9vw,1.55rem)] text-ink-soft">
                <Link href={`/authors/${book.author!.slug}`} className="link">
                  {authorName}
                </Link>
              </Reveal>
            ) : null}

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
              <Reveal delay={290} className="mt-7">
                {actions}
              </Reveal>
            ) : null}

            {book.view_count > 0 ? (
              <Reveal delay={350} className="mt-4 text-caption text-muted">
                {t('viewCount', { count: book.view_count })}
              </Reveal>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
