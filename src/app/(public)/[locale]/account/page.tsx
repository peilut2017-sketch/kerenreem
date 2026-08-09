import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/Container';
import { Link } from '@/i18n/navigation';
import { getCommerceFlags } from '@/lib/commerce/settings';
import {
  ensureCustomerRecord,
  getCustomerSession,
  getMyOrders,
  getMySavedBooks,
} from '@/lib/commerce/account';
import { customerStatusKey } from '@/lib/commerce/state-machines';
import { formatPrice } from '@/lib/commerce/pricing';
import { getBooksByIds } from '@/lib/data';
import { AccountClientSection } from '@/components/store/account/AccountClientSection';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'store' });
  return { title: t('accountTitle'), robots: { index: false } };
}

/**
 * האזור האישי (פרק 4.5) — עמוד אחד רזה: הזמנות, שמורים ופרטים. בכניסה
 * הראשונה נוצרת רשומת הלקוח ומשויכות הזמנות העבר של המייל המאומת
 * (החשבון הפסיבי, תרשים 18); המועדפים והמדף מהמכשיר מסונכרנים לחשבון.
 */
export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const flags = await getCommerceFlags();
  const t = await getTranslations('store');
  if (!flags.accountsEnabled) {
    return (
      <Container className="py-20 text-center">
        <p className="text-lead text-muted">{t('disabled')}</p>
      </Container>
    );
  }

  const session = await getCustomerSession();
  if (!session) redirect('/account/login');

  const customer = session.customer ?? (await ensureCustomerRecord(session));
  const [orders, saved] = await Promise.all([getMyOrders(), getMySavedBooks()]);
  const savedBooks = await getBooksByIds(saved.map((row) => row.book_id));

  return (
    <Container className="max-w-3xl py-12 lg:py-16">
      <header className="text-center">
        <p className="eyebrow">{t('accountTitle')}</p>
        <h1 className="mt-2 font-serif text-[clamp(1.6rem,3.4vw,2.2rem)] text-ink">
          {t('accountHello', { name: customer?.full_name ?? 'none' })}
        </h1>
      </header>

      <AccountClientSection />

      <section className="mt-10">
        <h2 className="font-serif text-h3 text-ink">{t('accountOrdersTitle')}</h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-small text-muted">{t('accountNoOrders')}</p>
        ) : (
          <ul className="mt-4 divide-y divide-rule rounded-[var(--radius-lg)] border border-rule bg-cream shadow-[var(--shadow-soft)]">
            {orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <span>
                  <Link
                    href={`/account/orders/${order.order_number}`}
                    className="font-semibold text-ink tabular-nums underline-offset-2 hover:text-burgundy hover:underline"
                  >
                    {t('trackOrderNumber', { number: order.order_number })}
                  </Link>
                  <span className="ms-3 text-caption text-muted">
                    {new Intl.DateTimeFormat(locale === 'en' ? 'en-IL' : 'he-IL', {
                      dateStyle: 'short',
                      timeZone: 'Asia/Jerusalem',
                    }).format(new Date(order.created_at))}
                  </span>
                </span>
                <span className="flex items-center gap-4">
                  <span className="rounded-[var(--radius-pill)] bg-cream-2 px-3 py-1 text-caption text-ink-soft">
                    {t(customerStatusKey(order) as 'statusReceived')}
                  </span>
                  <span className="font-serif text-ink tabular-nums">
                    {formatPrice(order.total, locale, { alwaysAgorot: true })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-h3 text-ink">{t('accountSavedTitle')}</h2>
        {savedBooks.length === 0 ? (
          <p className="mt-3 text-small text-muted">{t('accountSavedEmpty')}</p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {savedBooks.map((book) => (
              <li key={book.id}>
                <Link
                  href={`/books/${book.slug}`}
                  className="inline-block rounded-[var(--radius-pill)] border border-rule bg-cream px-3.5 py-1.5 text-small text-ink transition-colors hover:border-gold/60 hover:text-burgundy"
                >
                  {locale === 'en' && book.title_en ? book.title_en : book.title_he}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Container>
  );
}
