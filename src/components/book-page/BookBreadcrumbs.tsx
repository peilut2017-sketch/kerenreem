import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/Container';

/**
 * פירורי לחם שקטים מעל ה-Hero: ספרים / קטגוריה / שם הספר. לא כרטיס, לא
 * רקע — רק טקסט קטן שאומר "איפה אתה", בדיוק כמו במפרט (סעיף 7). הפריט
 * האחרון (שם הספר) אינו קישור.
 */
export async function BookBreadcrumbs({
  categoryName,
  categoryHref,
  title,
}: {
  categoryName: string | null;
  categoryHref: string | null;
  title: string;
}) {
  const t = await getTranslations('books');
  const nav = await getTranslations('nav');

  const items: { label: string; href?: string }[] = [
    { label: nav('home'), href: '/' },
    { label: nav('books'), href: '/books' },
    ...(categoryName ? [{ label: categoryName, href: categoryHref ?? undefined }] : []),
    { label: title },
  ];

  return (
    <nav aria-label={t('breadcrumbAria')} className="relative">
      <Container className="pt-5">
        <ol className="flex flex-wrap items-center gap-1.5 text-caption text-muted">
          {items.map((item, index) => (
            <li key={index} className="flex items-center gap-1.5">
              {index > 0 ? (
                <span aria-hidden="true" className="text-rule-strong">
                  /
                </span>
              ) : null}
              {item.href && index < items.length - 1 ? (
                <Link href={item.href} className="transition-colors hover:text-gold-deep">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={index === items.length - 1 ? 'page' : undefined}>{item.label}</span>
              )}
            </li>
          ))}
        </ol>
      </Container>
    </nav>
  );
}
