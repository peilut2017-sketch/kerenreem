import Link from 'next/link';
import { requireRole } from '@/lib/admin/auth';
import {
  getDashboardCounts,
  listDraftBooks,
  listRecentBooks,
  listUpcomingEvents,
} from '@/lib/admin/queries';
import { AdminHeader, PublishBadge } from '@/components/admin/AdminList';
import { formatDate, parseDateOnly } from '@/lib/hebrew-date';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const [session, { denied }] = await Promise.all([requireRole('viewer'), searchParams]);

  // חמש שאילתות מצומצמות במקביל, במקום שליפה של הקטלוג ולוח האירועים כולם.
  const [counts, recent, drafts, upcoming] = await Promise.all([
    getDashboardCounts(),
    listRecentBooks(),
    listDraftBooks(),
    listUpcomingEvents(),
  ]);

  const stats = [
    { label: 'ספרים בקטלוג', value: counts.books, href: '/admin/books' },
    { label: 'טיוטות', value: counts.drafts, href: '/admin/books' },
    { label: 'מחברים', value: counts.authors, href: '/admin/authors' },
    { label: 'אירועים', value: counts.events, href: '/admin/events' },
    { label: 'פניות שלא טופלו', value: counts.messages, href: '/admin/messages' },
  ];

  return (
    <>
      <AdminHeader title={`שלום, ${session.profile.full_name || 'עורך'}`} />

      {denied ? (
        <p role="alert" className="mb-8 border-s-2 border-burgundy bg-cream-2 px-4 py-3 text-small">
          אין לך הרשאה לאזור שביקשת.
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-cream p-4">
            <dt className="text-caption text-muted">
              <Link href={stat.href} className="hover:text-burgundy">
                {stat.label}
              </Link>
            </dt>
            <dd className="mt-1 font-serif text-h2 tabular-nums text-ink">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-12 grid gap-12 lg:grid-cols-2">
        <section aria-labelledby="dash-drafts">
          <h2 id="dash-drafts" className="eyebrow mb-3">
            טיוטות ממתינות
          </h2>
          {drafts.length === 0 ? (
            <p className="text-small text-muted">אין טיוטות פתוחות.</p>
          ) : (
            <ul className="border-t border-rule">
              {drafts.map((book) => (
                <li key={book.id} className="flex items-center justify-between gap-4 border-b border-rule py-2.5">
                  <Link href={`/admin/books/${book.id}`} className="text-small hover:text-burgundy">
                    {book.title_he}
                  </Link>
                  <PublishBadge published={book.is_published} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="dash-recent">
          <h2 id="dash-recent" className="eyebrow mb-3">
            נערכו לאחרונה
          </h2>
          {recent.length === 0 ? (
            <p className="text-small text-muted">טרם נוספו ספרים.</p>
          ) : (
            <ul className="border-t border-rule">
              {recent.map((book) => (
                <li key={book.id} className="flex items-center justify-between gap-4 border-b border-rule py-2.5">
                  <Link href={`/admin/books/${book.id}`} className="text-small hover:text-burgundy">
                    {book.title_he}
                  </Link>
                  <span className="shrink-0 text-caption text-muted">
                    {new Intl.DateTimeFormat('he-IL', { dateStyle: 'short' }).format(
                      new Date(book.updated_at),
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="dash-events">
          <h2 id="dash-events" className="eyebrow mb-3">
            אירועים קרובים
          </h2>
          {upcoming.length === 0 ? (
            <p className="text-small text-muted">אין אירועים קרובים.</p>
          ) : (
            <ul className="border-t border-rule">
              {upcoming.map((event) => {
                const date = parseDateOnly(event.event_date ?? '');
                return (
                  <li key={event.id} className="border-b border-rule py-2.5">
                    <Link href={`/admin/events/${event.id}`} className="text-small hover:text-burgundy">
                      {event.title_he}
                    </Link>
                    {date ? (
                      <p className="mt-0.5 text-caption text-muted">{formatDate(date, 'he', 'both')}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
