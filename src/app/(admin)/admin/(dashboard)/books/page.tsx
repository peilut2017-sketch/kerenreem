import { requireRole } from '@/lib/admin/auth';
import { listBookIdsWithTags, listBooks, listCategoriesAdmin } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { BooksDataGrid } from '@/components/admin/BooksDataGrid';

export const dynamic = 'force-dynamic';

export default async function AdminBooksPage() {
  await requireRole('viewer');
  const [books, bookIdsWithTags, categories] = await Promise.all([
    listBooks(),
    listBookIdsWithTags(),
    listCategoriesAdmin(),
  ]);

  return (
    <>
      <AdminHeader
        title="ספרים"
        description="הקטלוג — הנכס המרכזי של האתר."
        action={[
          { href: '/admin/books/new', label: 'ספר חדש', icon: 'plus' },
          { href: '/admin/books/settings', label: 'הגדרות קטלוג וחנות', icon: 'settings', variant: 'quiet' },
        ]}
      />

      {/* Set אינו נשלח כפי שהוא לרכיב לקוח — ההמרה למערך כאן, לא שם */}
      <BooksDataGrid
        books={books}
        bookIdsWithTags={[...bookIdsWithTags]}
        categories={categories.map((c) => ({ id: c.id, name: c.name_he }))}
      />
    </>
  );
}
