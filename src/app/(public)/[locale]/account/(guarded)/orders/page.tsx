import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getMyOrderCovers, getMyOrders } from '@/lib/commerce/account';
import { customerStatusKey } from '@/lib/commerce/state-machines';
import { formatPrice } from '@/lib/commerce/pricing';
import { BookCover } from '@/components/BookCover';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'store' });
  return { title: t('accountOrdersTitle'), robots: { index: false } };
}

/** [1.6] "כל ההזמנות שלי" (ט.2) — הרשימה המלאה, לעומת התצוגה המקדימה בטאב בעמוד הבית. */
export default async function AccountOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('store');

  const orders = await getMyOrders();
  const orderCovers = await getMyOrderCovers(orders.map((order) => order.id));
  const dateFormatter = new Intl.DateTimeFormat(locale === 'en' ? 'en-IL' : 'he-IL', {
    dateStyle: 'short',
    timeZone: 'Asia/Jerusalem',
  });

  return (
    <>
      <nav className="text-caption text-muted">
        <Link href="/account" className="underline-offset-2 hover:text-burgundy hover:underline">
          {t('accountBackToAccount')}
        </Link>
      </nav>
      <header className="mt-4">
        <p className="eyebrow">{t('accountTitle')}</p>
        <h1 className="mt-2 font-serif text-[clamp(1.6rem,3.4vw,2.2rem)] text-ink">
          {t('accountOrdersTitle')}
        </h1>
      </header>

      <div className="mt-8">
        {orders.length === 0 ? (
          <p className="text-small text-muted">{t('accountNoOrders')}</p>
        ) : (
          <ul className="divide-y divide-rule rounded-[var(--radius-lg)] border border-rule bg-cream shadow-[var(--shadow-soft)]">
            {orders.map((order) => {
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
        )}
      </div>
    </>
  );
}
