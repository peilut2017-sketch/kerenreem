import { SectionHeading } from '@/components/SectionHeading';
import { BookCarousel } from './BookCarousel';
import type { BookConnections } from '@/lib/data';

/**
 * "ספרים קשורים עם סיבה", לא רשימת "עוד ספרים" אחת. כל דלי מ-
 * getBookConnections (מחבר / קטגוריה / תגיות) מקבל קרוסלה נפרדת עם
 * כותרת שאומרת בדיוק למה הספרים האלה כאן.
 */
export function ConnectionsSection({
  connections,
  authorName,
  locale,
  t,
}: {
  connections: BookConnections;
  authorName: string | null;
  locale: string;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  const groups = [
    authorName && connections.sameAuthor.length > 0
      ? { key: 'author', title: t('connectionsAuthor', { name: authorName }), books: connections.sameAuthor }
      : null,
    connections.sameCategory.length > 0
      ? { key: 'category', title: t('connectionsCategory'), books: connections.sameCategory }
      : null,
    connections.sameTags.length > 0
      ? { key: 'tags', title: t('connectionsTags'), books: connections.sameTags }
      : null,
  ].filter((group): group is { key: string; title: string; books: typeof connections.sameAuthor } =>
    group !== null,
  );

  if (groups.length === 0) return null;

  return (
    <section aria-labelledby="book-connections" className="space-y-10">
      <SectionHeading level={2} title={t('navConnections')} id="book-connections" />
      {groups.map((group) => (
        <div key={group.key}>
          <h3 className="eyebrow mb-4">{group.title}</h3>
          <BookCarousel books={group.books} locale={locale} coverAltFor={(title) => t('coverAlt', { title })} />
        </div>
      ))}
    </section>
  );
}
