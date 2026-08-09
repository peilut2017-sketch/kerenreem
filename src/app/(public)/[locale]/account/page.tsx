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

      {/* [1.3] ניווט מהיר — כרטיסי הפעולות של החשבון (פרק 4.5) */}
      <nav aria-label={t('accountTitle')} className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <a
          href="#orders"
          className="group flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-rule bg-cream px-3 py-4 text-center shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:border-gold/60"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-burgundy">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 4 6v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6l-2-4H6ZM4 6h16M9 10a3 3 0 0 0 6 0" />
            </svg>
          </span>
          <span className="text-caption font-semibold text-ink group-hover:text-burgundy">
            {t('accountOrdersTitle')}
          </span>
        </a>
        <Link
          href="/account/addresses"
          className="group flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-rule bg-cream px-3 py-4 text-center shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:border-gold/60"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-burgundy">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </span>
          <span className="text-caption font-semibold text-ink group-hover:text-burgundy">
            {t('addressesTitle')}
          </span>
        </Link>
        <Link
          href="/account/settings"
          className="group flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-rule bg-cream px-3 py-4 text-center shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:border-gold/60"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-burgundy">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01A1.7 1.7 0 0 0 10 4.09V4a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01c.26.63.87 1.04 1.56 1.03H21a2 2 0 1 1 0 4h-.09c-.68 0-1.3.41-1.51 1.03Z" />
            </svg>
          </span>
          <span className="text-caption font-semibold text-ink group-hover:text-burgundy">
            {t('settingsTitle')}
          </span>
        </Link>
        <Link
          href="/favourites"
          className="group flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-rule bg-cream px-3 py-4 text-center shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:border-gold/60"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-burgundy">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H6.5A2.5 2.5 0 0 1 4 18.5V5a2 2 0 0 1 2-2h13v18ZM4 18.5A2.5 2.5 0 0 1 6.5 16H19" />
            </svg>
          </span>
          <span className="text-caption font-semibold text-ink group-hover:text-burgundy">
            {t('favouritesTitle')}
          </span>
        </Link>
      </nav>

      <section id="orders" className="mt-10 scroll-mt-24">
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
