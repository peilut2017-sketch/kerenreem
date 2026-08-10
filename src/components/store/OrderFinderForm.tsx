'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { findMyOrder } from '@/lib/commerce/track-actions';

/**
 * [1.6] "מצא את ההזמנה שלי" לאורח (ט.19, ביקורת ב.24) — מספר הזמנה +
 * טלפון/מייל תואם. בהצלחה מונפק טוקן חדש ומועברים ישירות לעמוד המעקב;
 * כל כשל (לא נמצא / לא תואם / קצב) מוצג כאותה הודעה גנרית אחת.
 */
export function OrderFinderForm() {
  const t = useTranslations('store');
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState('');
  const [contact, setContact] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'notFound' | 'rate' | 'error'>('idle');

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setState('busy');
        try {
          const result = await findMyOrder(orderNumber, contact);
          if (result.ok && result.token) {
            router.push(`/orders/track/${result.token}`);
            return;
          }
          setState(result.error === 'rate_limited' ? 'rate' : result.error === 'invalid' ? 'error' : 'notFound');
        } catch {
          setState('error');
        }
      }}
      className="mt-8 space-y-4"
    >
      <div>
        <label htmlFor="find-order-number" className="mb-1.5 block text-small font-semibold text-ink">
          {t('findOrderNumberLabel')}
        </label>
        <input
          id="find-order-number"
          type="text"
          inputMode="numeric"
          dir="ltr"
          required
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          className="commerce-field"
        />
      </div>
      <div>
        <label htmlFor="find-order-contact" className="mb-1.5 block text-small font-semibold text-ink">
          {t('findOrderContactLabel')}
        </label>
        <input
          id="find-order-contact"
          type="text"
          dir="ltr"
          required
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          className="commerce-field"
        />
      </div>
      {state === 'notFound' ? (
        <p role="alert" className="text-caption text-burgundy">{t('findOrderNotFound')}</p>
      ) : null}
      {state === 'rate' ? (
        <p role="alert" className="text-caption text-burgundy">{t('findOrderRateLimited')}</p>
      ) : null}
      {state === 'error' ? (
        <p role="alert" className="text-caption text-burgundy">{t('findOrderInvalid')}</p>
      ) : null}
      <button type="submit" disabled={state === 'busy'} className="btn btn-solid w-full">
        {t('findOrderSubmit')}
      </button>
    </form>
  );
}
