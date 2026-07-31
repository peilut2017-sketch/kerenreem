'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BookCover } from '@/components/BookCover';
import { SectionHeading } from '@/components/SectionHeading';
import { localized } from '@/lib/localized';
import type { BookConnections } from '@/lib/data';
import type { BookWithRelations } from '@/lib/supabase/types';

/**
 * "ספרים קשורים עם סיבה" — קרוסלה אחת עם שבבי סינון, לא ארבע קרוסלות
 * נפרדות זו מתחת לזו.
 *
 * הגרסה הקודמת נתנה שורה שלמה לכל סיבת קשר. בקטלוג אמיתי כל סיבה
 * מחזירה לרוב ספר או שניים, והתוצאה הייתה ארבע שורות שכל אחת כמעט
 * ריקה — הרבה גלילה עבור מעט ספרים. שבב סינון שומר על אותו מידע בדיוק
 * ("למה הספר הזה כאן") אבל מרכז את הספרים בשורה אחת מלאה, ומאפשר
 * לצמצם לסיבה מסוימת במקום לחפש אותה בין הכותרות.
 *
 * שבב מוצג רק אם יש מאחוריו ספרים — מסנן שמוביל תמיד לאפס תוצאות הוא
 * הבטחה שבורה.
 */
export function ConnectionsSection({
  connections,
  authorName,
  locale,
}: {
  connections: BookConnections;
  authorName: string | null;
  locale: string;
}) {
  const t = useTranslations('books');

  const groups = useMemo(
    () =>
      [
        authorName && connections.sameAuthor.length > 0
          ? { key: 'author', label: t('connectionsAuthor', { name: authorName }), books: connections.sameAuthor }
          : null,
        connections.sameSeries.length > 0
          ? { key: 'series', label: t('connectionsSeries'), books: connections.sameSeries }
          : null,
        connections.sameCategory.length > 0
          ? { key: 'category', label: t('connectionsCategory'), books: connections.sameCategory }
          : null,
        connections.sameTags.length > 0
          ? { key: 'tags', label: t('connectionsTags'), books: connections.sameTags }
          : null,
      ].filter((g): g is { key: string; label: string; books: BookWithRelations[] } => g !== null),
    [connections, authorName, t],
  );

  const [active, setActive] = useState('all');

  // "הכל" מאחד את כל הדליים בלי כפילויות: ספר יכול להיות גם מאותו מחבר
  // וגם מאותה קטגוריה, ואין סיבה שיופיע פעמיים באותה שורה.
  const all = useMemo(() => {
    const seen = new Set<string>();
    const merged: BookWithRelations[] = [];
    for (const group of groups) {
      for (const book of group.books) {
        if (seen.has(book.id)) continue;
        seen.add(book.id);
        merged.push(book);
      }
    }
    return merged;
  }, [groups]);

  if (groups.length === 0) return null;

  const shown = active === 'all' ? all : (groups.find((g) => g.key === active)?.books ?? all);

  return (
    <section aria-labelledby="book-connections">
      <SectionHeading level={2} title={t('navConnections')} id="book-connections" />

      {groups.length > 1 ? (
        <div role="group" aria-label={t('connectionsFilter')} className="mb-6 flex flex-wrap gap-2">
          {[{ key: 'all', label: t('connectionsAll') }, ...groups].map((chip) => (
            <button
              key={chip.key}
              type="button"
              aria-pressed={active === chip.key}
              onClick={() => setActive(chip.key)}
              className={`rounded-[var(--radius-pill)] border px-4 py-1.5 text-caption transition-colors ${
                active === chip.key
                  ? 'border-burgundy bg-burgundy text-white'
                  : 'border-rule text-ink-soft hover:border-burgundy hover:text-burgundy'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      ) : null}

      <ul className="flex gap-5 overflow-x-auto pb-2">
        {shown.map((book) => {
          const title = localized(book, 'title', locale);
          const author = book.author ? localized(book.author, 'name', locale) : null;
          return (
            <li key={book.id} className="w-36 shrink-0 sm:w-44">
              <Link href={`/books/${book.slug}`} className="group block focus-visible:outline-offset-4">
                <div className="transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-translate-y-1">
                  <BookCover src={book.cover_image_url} title={title} alt={t('coverAlt', { title })} sizes="176px" />
                </div>
                <h3 className="mt-3 line-clamp-2 text-small leading-snug text-ink group-hover:text-burgundy">
                  {title}
                </h3>
                {author ? <p className="mt-0.5 text-caption text-muted">{author}</p> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
