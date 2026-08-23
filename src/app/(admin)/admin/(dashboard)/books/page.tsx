import { requireScreenPermission } from '@/lib/admin/auth';
import {
  getUserPref,
  listBookCompletionSignals,
  listBooks,
  listCategoriesAdmin,
  listSeriesAdmin,
} from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { BOOKS_COLUMNS_PREF_KEY, BooksDataGrid } from '@/components/admin/BooksDataGrid';

export const dynamic = 'force-dynamic';

export default async function AdminBooksPage() {
  // הרשאת מסך ולא תפקיד בלבד: זו הייתה הרשימה היחידה שבדקה requireRole —
  // משתמש שהרשאת "ספרים" נשללה ממנו בלוח ההרשאות לא ראה את הקישור
  // בתפריט, אבל קיבל את הקטלוג המלא בכתובת ישירה.
  await requireScreenPermission('books', 'view');
  const [books, completionSignals, categories, series, savedColumns] = await Promise.all([
    listBooks(),
    listBookCompletionSignals(),
    listCategoriesAdmin(),
    listSeriesAdmin(),
    getUserPref<string[]>(BOOKS_COLUMNS_PREF_KEY),
  ]);

  return (
    <>
      <AdminHeader
        title="ספרים"
        description="הקטלוג — הנכס המרכזי של האתר."
        action={[
          { href: '/admin/books/new', label: 'ספר חדש', icon: 'plus' },
          { href: '/admin/books/readiness', label: 'לא מוכנים לחנות', icon: 'diagnostics', variant: 'quiet' },
          { href: '/admin/books/settings', label: 'הגדרות קטלוג וחנות', icon: 'settings', variant: 'quiet' },
        ]}
      />

      <BooksDataGrid
        books={books}
        completionSignals={completionSignals}
        categories={categories.map((c) => ({ id: c.id, name: c.name_he }))}
        series={series.map((s) => ({ id: s.id, name: s.name_he }))}
        initialVisibleColumns={Array.isArray(savedColumns) ? savedColumns : null}
      />
    </>
  );
}
