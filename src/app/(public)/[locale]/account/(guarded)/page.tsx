import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getCommerceFlags } from '@/lib/commerce/settings';
import {
  ensureCustomerRecord,
  getCustomerSession,
  getMyDocuments,
  getMyOrderCovers,
  getMyOrders,
  getMySavedBooks,
} from '@/lib/commerce/account';
import { customerStatusKey } from '@/lib/commerce/state-machines';
import { formatPrice } from '@/lib/commerce/pricing';
import { getBooksByIds } from '@/lib/data';
import { AccountClientSection } from '@/components/store/account/AccountClientSection';
import { AccountTabs } from '@/components/store/account/AccountTabs';
import { BookCardGrid } from '@/components/books/BookCardGrid';
import { BookCover } from '@/components/BookCover';

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

const DOC_TYPE_KEYS: Record<string, string> = {
  invoice_receipt: 'docTypeInvoiceReceipt',
  receipt: 'docTypeReceipt',
  donation_receipt: 'docTypeDonationReceipt',
  credit_note: 'docTypeCreditNote',
};

/**
 * האזור האישי (פרק 4.5) — כניסה ראשונה יוצרת רשומת לקוח ומשייכת הזמנות
 * עבר (תרשים 18); המועדפים והמדף מהמכשיר מסונכרנים לחשבון. [1.6] מבנה
 * טאבים (ט.2) במקום עמוד ארוך אחד — הזמנות/שמורים/מסמכים; ה-guard
 * (הרשאה + session) עבר ל-(guarded)/layout.tsx (ביקורת ב.28/ב.29).
 */
export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('store');

  const session = await getCustomerSession();
  if (!session) return null;

  const customer = session.customer ?? (await ensureCustomerRecord(session));
  const [flags, orders, saved, documents] = await Promise.all([
    getCommerceFlags(),
    getMyOrders(),
    getMySavedBooks(),
    getMyDocuments(),
  ]);
  const savedBooks = await getBooksByIds(saved.map((row) => row.book_id));

  const dateFormatter = new Intl.DateTimeFormat(locale === 'en' ? 'en-IL' : 'he-IL', {
    dateStyle: 'short',
    timeZone: 'Asia/Jerusalem',
  });
  const ordersPreview = orders.slice(0, 5);
  // [1.6] כריכות לכרטיסי ההזמנות (ח.15) — רק עבור התצוגה המקדימה המוצגת בפועל
  const orderCovers = await getMyOrderCovers(ordersPreview.map((order) => order.id));

  return (
    <>
      <header className="text-center">
        <p className="eyebrow">{t('accountTitle')}</p>
        <h1 className="mt-2 font-serif text-[clamp(1.6rem,3.4vw,2.2rem)] text-ink">
          {t('accountHello', { name: customer?.full_name ?? 'none' })}
        </h1>
      </header>

      <AccountClientSection />

      {/* [1.3] ניווט מהיר — כתובות/הגדרות/מועדפים (פרק 4.5). "הזמנות"
          הוסר מכאן: הוא כעת טאב גלוי מיד מתחת, לא עוגן גלילה נסתר. */}
      <nav aria-label={t('accountTitle')} className="mt-8 grid grid-cols-3 gap-3">
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

      <AccountTabs
        ariaLabel={t('accountTitle')}
        tabs={[
          {
            key: 'orders',
            label: t('accountOrdersTitle'),
            content:
              orders.length === 0 ? (
                <p className="text-small text-muted">{t('accountNoOrders')}</p>
              ) : (
                <>
                  <ul className="divide-y divide-rule rounded-[var(--radius-lg)] border border-rule bg-cream shadow-[var(--shadow-soft)]">
                    {ordersPreview.map((order) => {
                      const cover = orderCovers[order.id];
                      return (
                        <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                          <span className="flex items-center gap-3">
                            <span className="w-10 shrink-0" aria-hidden="true">
                              <BookCover src={cover?.coverImageUrl ?? null} title="" alt="" sizes="40px" />
                            </span>
                            <span>
                              <Link
                                href={`/account/orders/${order.order_number}`}
                                className="font-semibold text-ink tabular-nums underline-offset-2 hover:text-burgundy hover:underline"
                              >
                                {t('trackOrderNumber', { number: order.order_number })}
                              </Link>
                              <span className="ms-3 text-caption text-muted">
                                {dateFormatter.format(new Date(order.created_at))}
                              </span>
                              {cover && cover.itemCount > 1 ? (
                                <span className="ms-2 text-caption text-muted">
                                  {t('accountOrderMoreItems', { count: cover.itemCount - 1 })}
                                </span>
                              ) : null}
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
                      );
                    })}
                  </ul>
                  {orders.length > ordersPreview.length ? (
                    <p className="mt-4 text-center">
                      <Link href="/account/orders" className="text-small text-burgundy underline underline-offset-2">
                        {t('accountViewAllOrders')}
                      </Link>
                    </p>
                  ) : null}
                </>
              ),
          },
          {
            key: 'saved',
            label: t('accountSavedTitle'),
            content:
              savedBooks.length === 0 ? (
                <p className="text-small text-muted">{t('accountSavedEmpty')}</p>
              ) : (
                <BookCardGrid books={savedBooks} locale={locale} storeEnabled={flags.showPrices} />
              ),
          },
          {
            key: 'documents',
            label: t('accountDocumentsTitle'),
            content:
              documents.length === 0 ? (
                <p className="text-small text-muted">{t('accountDocumentsEmpty')}</p>
              ) : (
                <ul className="divide-y divide-rule rounded-[var(--radius-lg)] border border-rule bg-cream shadow-[var(--shadow-soft)]">
                  {documents.map(({ document, orderNumber }) => (
                    <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <span>
                        <span className="font-semibold text-ink">
                          {t(
                            (DOC_TYPE_KEYS[document.doc_type] ?? 'docTypeReceipt') as 'docTypeReceipt',
                          )}
                        </span>
                        {orderNumber ? (
                          <Link
                            href={`/account/orders/${orderNumber}`}
                            className="ms-2 text-caption text-muted underline-offset-2 hover:text-burgundy hover:underline"
                          >
                            {t('trackOrderNumber', { number: orderNumber })}
                          </Link>
                        ) : null}
                        <span className="ms-2 text-caption text-muted">
                          {dateFormatter.format(new Date(document.issued_at ?? document.created_at))}
                        </span>
                      </span>
                      <span className="flex items-center gap-4">
                        <span className="font-serif text-ink tabular-nums">
                          {formatPrice(document.amount, locale)}
                        </span>
                        {document.download_url ? (
                          <a
                            href={document.download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-small text-burgundy underline underline-offset-2"
                          >
                            {t('accountDocumentView')}
                          </a>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ),
          },
        ]}
      />
    </>
  );
}
