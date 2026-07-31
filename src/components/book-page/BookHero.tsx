import { Link } from '@/i18n/navigation';
import { Reveal } from '@/components/Reveal';
import { FloatingCover } from './FloatingCover';
import { HeroBackground } from './HeroBackground';
import { SmartTag } from './SmartTag';
import type { BookWithRelations } from '@/lib/supabase/types';
import type { CoverPalette } from '@/lib/cover-colors';

/**
 * Hero כמעט ריק: הרקע נגזר מצבעי הכריכה, הכריכה עצמה מרחפת במרכז, וכל
 * פרט מידע מופיע בהדרגה (Reveal עם delay עולה) ולא בבת אחת. לא "תמונה |
 * מידע | מחיר" — הספר הוא המרכז, השאר מסתדר סביבו.
 */
export function BookHero({
  book,
  palette,
  title,
  subtitle,
  authorName,
  categoryName,
  year,
  t,
}: {
  book: BookWithRelations;
  palette: CoverPalette;
  title: string;
  subtitle: string | null;
  authorName: string | null;
  categoryName: string | null;
  year: string;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  return (
    /* בלי -mx-*: ה-Hero יושב ישירות תחת <article> ברמת העמוד, לא בתוך
       Container. שוליים שליליים כאן אינם "בליטה עד הקצה" אלא גלישה
       אופקית ממשית של המסמך כולו — נמדד: 1328px רוחב במסך 1280. */
    <section id="book-hero" className="relative overflow-hidden px-4 pb-16 pt-10 sm:px-6">
      <HeroBackground colors={palette.colors} />

      <div className="relative mx-auto grid max-w-5xl gap-10 sm:grid-cols-[16rem_minmax(0,1fr)] sm:items-center sm:gap-14">
        <FloatingCover src={book.cover_image_url} title={title} alt={t('coverAlt', { title })} />

        <div className="text-center sm:text-start">
          <Reveal as="h1" className="font-serif text-[clamp(2rem,4vw,3rem)] leading-tight text-ink">
            {title}
          </Reveal>

          {subtitle ? (
            <Reveal delay={120} as="p" className="mt-3 text-lead text-ink-soft">
              {subtitle}
            </Reveal>
          ) : null}

          <Reveal delay={220} className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-body text-ink-soft sm:justify-start">
            {authorName ? (
              <Link href={`/authors/${book.author!.slug}`} className="link">
                {authorName}
              </Link>
            ) : null}
            {authorName && (categoryName || year) ? <span aria-hidden="true">·</span> : null}
            {categoryName ? <span>{categoryName}</span> : null}
            {categoryName && year ? <span aria-hidden="true">·</span> : null}
            {year ? <span className="tabular-nums">{year}</span> : null}
          </Reveal>

          {book.tags && book.tags.length > 0 ? (
            <Reveal delay={320} className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-start">
              {book.tags.map((tag) => (
                <SmartTag key={tag.id} label={tag.name_he} slug={tag.slug} description={tag.description_he} />
              ))}
            </Reveal>
          ) : null}

          {book.view_count > 0 ? (
            <Reveal delay={380} className="mt-4 text-caption text-muted">
              {t('viewCount', { count: book.view_count })}
            </Reveal>
          ) : null}
        </div>
      </div>
    </section>
  );
}
