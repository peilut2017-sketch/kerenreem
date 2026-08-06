import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/Container';
import { getTrackedOrder } from '@/lib/commerce/track';
import { allowRequest, ipBucket } from '@/lib/commerce/rate-limit';
import { formatPrice } from '@/lib/commerce/pricing';
import { formatPromisedDate } from '@/lib/commerce/delivery-date';
import { getStoreSettings } from '@/lib/commerce/settings';

/**
 * עמוד המעקב הממותג לאורח (פרק 16.1): זיהוי בטוקן חד-פעמי מהמייל,
 * בצד השרת בלבד. טוקן לא תקף — הודעה גנרית, בלי לאשר שההזמנה קיימת.
 * לא הפניה עירומה לאתר שילוח — הסטטוס, הציר, התאריך והמסמך כולם כאן.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'store' });
  return { title: t('trackTitle'), robots: { index: false, follow: false } };
}

const STEP_ORDER = ['stepOrdered', 'stepPaid', 'stepPreparing', 'stepShipped', 'stepDelivered'];

function stepsFor(statusKey: string, isPickup: boolean): { key: string; reached: boolean }[] {
  const shippedKey = isPickup ? 'stepPickup' : 'stepShipped';
  const sequence = STEP_ORDER.map((key) => (key === 'stepShipped' ? shippedKey : key));
  const reachedIndex =
    statusKey === 'statusPendingPayment' || statusKey === 'statusPaymentFailed'
      ? 0
      : statusKey === 'statusReceived'
        ? 1
        : statusKey === 'statusPreparing'
          ? 2
          : statusKey === 'statusShipped' || statusKey === 'statusReadyForPickup'
            ? 3
            : statusKey === 'statusDelivered'
              ? 4
              : 1;
  return sequence.map((key, index) => ({ key, reached: index <= reachedIndex }));
}

export default async function TrackOrderPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('store');

  const headerList = await headers();
  const allowed = await allowRequest(ipBucket('order-track', headerList), 30, 60);
  const tracked = allowed ? await getTrackedOrder(token) : null;

  if (!tracked) {
    return (
      <Container className="py-20 text-center">
        <h1 className="font-serif text-h2 text-ink">{t('trackNotFoundTitle')}</h1>
        <p className="mt-3 text-lead text-muted">{t('trackNotFoundBody')}</p>
      </Container>
    );
  }

  const { order, items, statusKey, documentUrl } = tracked;
  const settings = await getStoreSettings();
  const isPickup = order.fulfillment_type === 'pickup';
  const cancelled = statusKey === 'statusCancelled' || statusKey === 'statusRefunded';
  const steps = stepsFor(statusKey, isPickup);

  return (
    <Container className="max-w-3xl py-12 lg:py-16">
      <header className="text-center">
        <p className="eyebrow">{t('trackTitle')}</p>
        <h1 className="mt-2 font-serif text-[clamp(1.6rem,3.4vw,2.2rem)] text-ink">
          {t('trackOrderNumber', { number: order.order_number })}
        </h1>
        <p className="mt-2 text-lead text-ink-soft">{t(statusKey as 'statusReceived')}</p>
      </header>

      {!cancelled ? (
        <ol className="mx-auto mt-8 flex max-w-xl items-center justify-between gap-1" aria-label={t('trackTitle')}>
          {steps.map((step, index) => (
            <li key={step.key} className="flex flex-1 items-center gap-1 last:flex-none">
              <span className="flex flex-col items-center gap-1.5 text-center">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-caption font-bold ${
                    step.reached ? 'bg-gold text-navy' : 'bg-cream-2 text-muted'
                  }`}
                  aria-hidden="true"
                >
                  {step.reached ? '✓' : index + 1}
                </span>
                <span className={`text-caption ${step.reached ? 'text-ink' : 'text-muted'}`}>
                  {t(step.key as 'stepOrdered')}
                </span>
              </span>
              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={`mx-1 h-0.5 flex-1 rounded ${step.reached ? 'bg-gold' : 'bg-cream-2'}`}
                />
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      {order.promised_delivery_date && !cancelled ? (
        <p className="mt-6 text-center text-small text-muted">
          {t('deliveryEstimate', {
            date: formatPromisedDate(new Date(order.promised_delivery_date), locale),
          })}
        </p>
      ) : null}

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

        {documentUrl ? (
          <p className="mt-4">
            <a
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-small text-burgundy underline underline-offset-2"
            >
              {t('trackDocumentLink')}
            </a>
          </p>
        ) : null}
      </section>

      {settings.support_phone ? (
        <p className="mt-6 text-center text-caption text-muted">
          {t('phoneHelp', { phone: settings.support_phone })}
        </p>
      ) : null}
    </Container>
  );
}
