import Link from 'next/link';
import { requireRole } from '@/lib/admin/auth';
import { listBooks } from '@/lib/admin/queries';
import { AdminCell, AdminHeader, AdminRow, AdminTable } from '@/components/admin/AdminList';
import { RowActions } from '@/components/admin/RowActions';

export const dynamic = 'force-dynamic';

export default async function AdminBooksPage() {
  await requireRole('viewer');
  const books = await listBooks();

  return (
    <>
      <AdminHeader
        title="ספרים"
        description="הקטלוג — הנכס המרכזי של האתר."
        action={{ href: '/admin/books/new', label: 'ספר חדש' }}
      />

      <AdminTable
        columns={['#', 'שם הספר', 'מחבר', 'שנה', 'מצב ופעולות']}
        empty={books.length === 0 ? 'טרם נוספו ספרים.' : undefined}
      >
        {books.map((book) => (
          <AdminRow key={book.id}>
            <AdminCell className="text-muted tabular-nums">{book.catalogue_number}</AdminCell>
            <AdminCell>
              <Link href={`/admin/books/${book.id}`} className="font-semibold hover:text-burgundy">
                {book.title_he}
              </Link>
              {book.subtitle_he ? (
                <span className="mt-0.5 block text-caption text-muted">{book.subtitle_he}</span>
              ) : null}
            </AdminCell>
            <AdminCell className="text-muted">{book.author?.name_he ?? '—'}</AdminCell>
            <AdminCell className="text-muted">
              {book.publication_year_he || book.publication_year_ce || '—'}
            </AdminCell>
            <AdminCell>
              <RowActions
                entity="books"
                id={book.id}
                label={book.title_he}
                published={book.is_published}
              />
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>
    </>
  );
}
