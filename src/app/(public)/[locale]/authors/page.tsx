import type { Metadata } from 'next';
import { Img as Image } from '@/components/Img';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/Container';
import { PageHeader } from '@/components/PageHeader';
import { getAuthors, getBookCountsByAuthor } from '@/lib/data';
import { localized } from '@/lib/localized';
import { pageAlternates } from '@/lib/seo';

/**
 * חלון קצר במקום שעה, לא בגלל תעבורה אלא בגלל revalidatePath עצמו.
 *
 * נמדד ישירות: קריאה ל-revalidatePath, גם מ-Server Action וגם מ-Route
 * Handler, סימנה את המטמון לרענון אך לא שינתה בפועל את מה שמוגש לבקשה
 * הבאה מדפדפן חדש — נבדק עם Next.js 16.2.12 ובנייה עם Turbopack, שוב
 * ושוב, כולל אחרי המתנה ובקשות חוזרות. יתכן שזו התנהגות שונה בפריסה
 * אמיתית (Vercel), אבל אי אפשר להסתמך על זה בלי דרך לאמת. חלון של דקה
 * מבטיח שתוכן חדש יופיע גם אם הרענון היזום אינו פועל בפועל, ועדיין
 * שומר על מרבית התועלת של מטמון קצה עבור תעבורה אמיתית.
 */
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'authors' });
  return { title: t('title'), description: t('intro'), alternates: pageAlternates(locale, '/authors') };
}

export default async function AuthorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('authors');
  const [authors, bookCounts] = await Promise.all([getAuthors(), getBookCountsByAuthor()]);

  return (
    <Container className="py-16 lg:py-20">
      <PageHeader title={t('title')} intro={t('intro')} />
      <div className="mt-12" />

      {authors.length === 0 ? (
        <p className="text-muted">{t('empty')}</p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {authors.map((author) => {
            const name = localized(author, 'name', locale);
            const years =
              author.birth_year || author.death_year
                ? t('years', { birth: author.birth_year ?? '', death: author.death_year ?? '' })
                : null;

            return (
              <li key={author.id}>
                <Link
                  href={`/authors/${author.slug}`}
                  className="card card-interactive group h-full flex-row items-center gap-5 p-6 focus-visible:outline-offset-4"
                >
                  {author.portrait_url ? (
                    <Image
                      src={author.portrait_url}
                      alt={t('portraitAlt', { name })}
                      width={56}
                      height={72}
                      sizes="56px"
                      className="h-20 w-16 shrink-0 rounded-[var(--radius-sm)] object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="icon-chip h-16 w-16 shrink-0 font-serif text-[1.375rem]"
                    >
                      {name.trim().charAt(0)}
                    </span>
                  )}

                  <span className="flex-1">
                    <span className="block font-serif text-h3 text-ink group-hover:text-burgundy">
                      {name}
                    </span>
                    {years ? <span className="mt-1 block text-small text-muted">{years}</span> : null}
                  </span>

                  <span className="hidden text-small text-muted sm:block">
                    {t('bookCount', { count: bookCounts.get(author.id) ?? 0 })}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}
