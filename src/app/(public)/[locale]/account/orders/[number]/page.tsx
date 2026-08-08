import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/Container';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCustomerSession, getMyOrderByNumber } from '@/lib/commerce/account';
import { customerStatusKey } from '@/lib/commerce/state-machines';
import { formatPrice } from '@/lib/commerce/pricing';
import { formatPromisedDate } from '@/lib/commerce/delivery-date';
import type { CommerceDocument, OrderItem } from '@/lib/supabase/types';

/**
 * עמוד הזמנה באזור האישי (פרק 4.7) — היעד של הקישור שנשלח במיילים
 * ללקוח מחובר. פריטים מהצילום, סטטוס בשפת לקוח, מסמכים להורדה.
 * הגישה דרך ה-RLS של הלקוח: הזמנה שאינה שלו — 404 גנרי.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'store' });
  return { title: t('accountOrderTitle'), robots: { index: false } };
}

export default async function AccountOrderPage({
  params,
}: {
  params: Promise<{ locale: string; number: string }>;
}) {
  const { locale, number } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('store');

  const session = await getCustomerSession();
  if (!session) redirect(`/account/login`);

  const orderNumber = Number(number);
  if (!Number.isInteger(orderNumber) || orderNumber <= 0) notFound();
  const order = await getMyOrderByNumber(orderNumber);
  if (!order) notFound();

  const supabase = await createClient();
  const [itemsRes, documentsRes] = supabase
    ? await Promise.all([
        supabase
          .from('order_items')
          .select('title_snapshot, quantity, unit_price, line_total')
          .eq('order_id', order.id),
        supabase
          .from('documents')
          .select('doc_type, doc_number, download_url, status')
          .eq('order_id', order.id)
          .eq('status', 'created'),
      ])
    : [{ data: [] }, { data: [] }];
  const items = (itemsRes.data ?? []) as Pick<
    OrderItem,
    'title_snapshot' | 'quantity' | 'unit_price' | 'line_total'
  >[];
  const documents = (documentsRes.data ?? []) as Pick<
    CommerceDocument,
    'doc_type' | 'doc_number' | 'download_url' | 'status'
  >[];

  const statusKey = customerStatusKey(order);

  return (
    <Container className="max-w-3xl py-12 lg:py-16">
      <header className="text-center">
        <p className="eyebrow">{t('accountOrdersTitle')}</p>
        <h1 className="mt-2 font-serif text-[clamp(1.6rem,3.4vw,2.2rem)] text-ink">
          {t('trackOrderNumber', { number: order.order_number })}
        </h1>
        <p className="mt-2 text-lead text-ink-soft">{t(statusKey as 'statusReceived')}</p>
        {order.promised_delivery_date && order.state !== 'cancelled' ? (
          <p className="mt-2 text-small text-muted">
            {t('deliveryEstimate', {
              date: formatPromisedDate(new Date(order.promised_delivery_date), locale),
            })}
          </p>
        ) : null}
      </header>

      <section className="mt-10 rounded-[var(--radius-lg)] border border-rule bg-cream px-6 py-6 shadow-[var(--shadow-soft)]">
        <h2 className="font-serif text-h3 text-ink">{t('trackItemsTitle')}</h2>
        <ul className="mt-4 divide-y divide-rule">
          {items.map((item, index) => (
            <li key={index} className="flex justify-between gap-4 py-2.5 text-small">
              <span className="text-ink">
                {item.title_snapshot} ×{item.quantity}
              </span>
              <span className="tabular-nums text-ink-soft">
                {formatPrice(item.line_total ?? item.unit_price * item.quantity, locale)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1.5 border-t border-rule pt-3 text-small text-ink-soft">
          {order.discount_total > 0 ? (
            <div className="flex justify-between">
              <dt>{t('discount')}</dt>
              <dd className="tabular-nums">−{formatPrice(order.discount_total, locale)}</dd>
            </div>
          ) : null}
          {order.shipping_total > 0 ? (
            <div className="flex justify-between">
              <dt>{t('shipping')}</dt>
              <dd className="tabular-nums">{formatPrice(order.shipping_total, locale)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between text-ink">
            <dt className="font-semibold">{t('total')}</dt>
            <dd className="font-serif tabular-nums">
              {formatPrice(order.total, locale, { alwaysAgorot: true })}
            </dd>
          </div>
        </dl>

        {documents.length > 0 ? (
          <div className="mt-4 space-y-1.5 border-t border-rule pt-3">
            {documents.map((doc, index) =>
              doc.download_url ? (
                <p key={index}>
                  <a
                    href={doc.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-small text-burgundy underline underline-offset-2"
                  >
                    {t('trackDocumentLink')}
                    {doc.doc_number ? ` (${doc.doc_number})` : ''}
                  </a>
                </p>
              ) : null,
            )}
          </div>
        ) : null}
      </section>

      <p className="mt-8 text-center">
        <Link href="/account" className="text-small text-muted underline-offset-2 hover:text-burgundy hover:underline">
          ← {t('accountBackToAccount')}
        </Link>
      </p>
    </Container>
  );
}
