import Link from 'next/link';
import { requireScreenPermission } from '@/lib/admin/auth';
import { listBookCompletionSignals, listBooks } from '@/lib/admin/queries';
import { computeCompletion, type CompletionSignals } from '@/lib/completion';
import { AdminHeader } from '@/components/admin/AdminList';
import { StatTile } from '@/components/admin/analytics/StatTile';
import { BookReadinessList, type ReadinessRow } from '@/components/admin/books/BookReadinessList';

export const dynamic = 'force-dynamic';

/**
 * [1.5] "ספרים שלא מוכנים לחנות" (ביקורת ג.7/ט.11) — כלי ההכנה המרכזי
 * לפני פתיחת החנות. computeCompletion כבר בודק מחיר/משקל/מלאי לספר
 * שסומן לרכישה, אבל בלי מסך מרכז אין דרך למצוא ספר חסר בלי לפתוח כל
 * כרטיס בנפרד. כאן: אותו computeCompletion בדיוק, על כל ספרי הרכישה,
 * עם צבירה לפי סוג חוסר וקישור ישיר לכל ספר.
 */
export default async function BooksReadinessPage() {
  await requireScreenPermission('books-readiness', 'view');
  const [books, signalIds] = await Promise.all([listBooks(), listBookCompletionSignals()]);
  const sets = {
    tags: new Set(signalIds.tags),
    shelves: new Set(signalIds.shelves),
    attributes: new Set(signalIds.attributes),
    images: new Set(signalIds.images),
    toc: new Set(signalIds.toc),
    previews: new Set(signalIds.previews),
  };

  const purchasable = books.filter((book) => book.is_purchasable);
  const rows: ReadinessRow[] = purchasable
    .map((book) => {
      const signals: CompletionSignals = {
        tagIds: sets.tags.has(book.id) ? ['_'] : [],
        categoryIds: sets.shelves.has(book.id) ? ['_'] : [],
        attributeValueIds: sets.attributes.has(book.id) ? ['_'] : [],
        galleryCount: sets.images.has(book.id) ? 1 : 0,
        tocCount: sets.toc.has(book.id) ? 1 : 0,
        previewCount: sets.previews.has(book.id) ? 1 : 0,
      };
      const completion = computeCompletion(book, signals);
      return { book, missing: completion.missing, percent: completion.percent };
    })
    .filter((row) => row.missing.length > 0)
    .sort((a, b) => a.percent - b.percent);

  const countsByKey = new Map<string, { label: string; count: number }>();
  for (const row of rows) {
    for (const item of row.missing) {
      const entry = countsByKey.get(item.key) ?? { label: item.label, count: 0 };
      entry.count += 1;
      countsByKey.set(item.key, entry);
    }
  }
  const aggregated = [...countsByKey.values()].sort((a, b) => b.count - a.count);

  return (
    <>
      <AdminHeader
        title="ספרים שלא מוכנים לחנות"
        description="כל ספר שסומן 'ניתן לרכישה' אך חסר בו שדה שהחנות זקוקה לו — מחיר, משקל למשלוח, מלאי, או תוכן בסיסי. אין חלון תאריכים: אלה בעיות פתוחות עכשיו."
        action={{ href: '/admin/books', label: 'כל הספרים', variant: 'quiet' }}
      />

      {purchasable.length === 0 ? (
        <div className="admin-card px-5 py-8 text-center text-small text-muted">
          אין עדיין ספרים שסומנו &quot;ניתן לרכישה&quot;.
        </div>
      ) : rows.length === 0 ? (
        <div className="admin-card px-5 py-8 text-center">
          <p className="text-small text-ink">
            כל {purchasable.length.toLocaleString('he-IL')} ספרי הרכישה מוכנים לחנות. תקין.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {aggregated.map((entry) => (
              <StatTile key={entry.label} icon="diagnostics" label={entry.label} value={entry.count.toLocaleString('he-IL')} />
            ))}
          </div>

          <p className="mb-3 text-caption text-muted">
            {rows.length.toLocaleString('he-IL')} מתוך {purchasable.length.toLocaleString('he-IL')} ספרי הרכישה
            חסרים שדה אחד לפחות, ממוינים מהחסר ביותר.
          </p>

          <BookReadinessList rows={rows} />
        </>
      )}

      <p className="mt-6 text-caption text-muted">
        רוצים לראות גם ספרי קטלוג (שאינם מסומנים לרכישה)?{' '}
        <Link href="/admin/books" className="link">
          כל הספרים
        </Link>{' '}
        מציגה את מד ההשלמה לכולם.
      </p>
    </>
  );
}
