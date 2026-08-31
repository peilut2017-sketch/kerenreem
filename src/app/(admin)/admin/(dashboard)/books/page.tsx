import { requireScreenPermission, screenAccess } from '@/lib/admin/auth';
import {
  getUserPref,
  listBookCompletionSignals,
  listBooks,
  listCategoriesAdmin,
  listSeriesAdmin,
} from '@/lib/admin/queries';
import { getStoreSettings } from '@/lib/commerce/settings';
import { AdminHeader } from '@/components/admin/AdminList';
import { BOOKS_COLUMNS_PREF_KEY, BooksDataGrid } from '@/components/admin/BooksDataGrid';

export const dynamic = 'force-dynamic';

export default async function AdminBooksPage() {
  // כמו כל שאר מסכי הרשימה — ההרשאה הגרגרית, לא requireRole('viewer')
  // שכל תפקיד צוות עובר (מלקט/מוכרן היו רואים את מסך הקטלוג המלא).
  const session = await requireScreenPermission('books', 'view');
  const [books, completionSignals, categories, series, savedColumns, storeSettings, settingsAccess] =
    await Promise.all([
      listBooks(),
      listBookCompletionSignals(),
      listCategoriesAdmin(),
      listSeriesAdmin(),
      getUserPref<string[]>(BOOKS_COLUMNS_PREF_KEY),
      getStoreSettings(),
      screenAccess(session, 'store-settings'),
    ]);

  const actions = [
    { href: '/admin/books/new', label: 'ספר חדש', icon: 'plus' as const },
    { href: '/admin/books/readiness', label: 'לא מוכנים לחנות', icon: 'diagnostics' as const, variant: 'quiet' as const },
    // מוצג רק למי שבאמת רשאי להיכנס למסך ההגדרות — אחרת עורך תוכן היה
    // לוחץ על כפתור נראה ומוחזר לדשבורד עם denied=1.
    ...(settingsAccess.view
      ? [{ href: '/admin/books/settings', label: 'הגדרות קטלוג וחנות', icon: 'settings' as const, variant: 'quiet' as const }]
      : []),
  ];

  return (
    <>
      <AdminHeader title="ספרים" description="הקטלוג — הנכס המרכזי של האתר." action={actions} />

      <BooksDataGrid
        books={books}
        completionSignals={completionSignals}
        categories={categories.map((c) => ({ id: c.id, name: c.name_he }))}
        series={series.map((s) => ({ id: s.id, name: s.name_he }))}
        initialVisibleColumns={Array.isArray(savedColumns) ? savedColumns : null}
        lowStockThreshold={storeSettings.low_stock_threshold ?? 2}
      />
    </>
  );
}
