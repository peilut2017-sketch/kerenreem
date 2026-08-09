'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer } from '@/components/Drawer';
import { startAdminCardPayment } from '@/lib/admin/orders-actions';

/**
 * [1.5] גביית תשלום באשראי בזמן שיחה: פותח את דף התשלום המאובטח של
 * מורנינג בתוך iframe (לא redirect מלא), כדי שהנציג יישאר בעמוד ההזמנה
 * ויקליד את הפרטים שהלקוח מקריא ישירות לתוך שדה מורנינג — הפרטים לא
 * עוברים דרך שרת האתר שלנו בשום שלב. אחרי סיום, PaymentReturnSignal
 * בתוך ה-iframe (עכשיו same-origin) מודיע ב-postMessage ואנחנו מרעננים;
 * ה-payment_state עצמו מתעדכן רק ע"י ה-Webhook (יכול לפגר כמה שניות
 * אחרי סגירת הטופס) — לכן רענון כפול, לא ודאות מיידית.
 */
export function CardPaymentDrawer({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<'success' | 'failure' | null>(null);

  function openDrawer() {
    setOpen(true);
    setError(null);
    setPaymentUrl(null);
    setOutcome(null);
    startTransition(async () => {
      const result = await startAdminCardPayment(orderId);
      if (result.ok) setPaymentUrl(result.paymentUrl);
      else setError(result.error);
    });
  }

  useEffect(() => {
    if (!open) return;
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; outcome?: string } | null;
      if (data?.type !== 'kr-admin-payment-return') return;
      setOutcome(data.outcome === 'success' ? 'success' : 'failure');
      router.refresh();
      setTimeout(() => router.refresh(), 3000);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [open, router]);

  return (
    <>
      <button type="button" onClick={openDrawer} className="admin-btn admin-btn-solid">
        גביית תשלום באשראי
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        titleId="card-payment-drawer-title"
        title="גביית תשלום באשראי"
        variant="center"
        widthClassName="max-w-[30rem]"
      >
        <p className="mb-3 text-caption text-muted">
          הקריאו ללקוח את פרטי הכרטיס והקלידו אותם ישירות לטופס המאובטח של מורנינג
          למטה — הפרטים מגיעים אליה בלבד ולא עוברים דרך שרת האתר שלנו.
        </p>
        {pending ? <p className="text-small text-muted">טוען טופס תשלום מאובטח…</p> : null}
        {error ? (
          <p
            role="alert"
            className="rounded-[var(--radius-sm)] bg-[var(--admin-danger-soft)] px-3 py-2 text-caption text-[var(--admin-danger)]"
          >
            ⚠ {error}
          </p>
        ) : null}
        {outcome ? (
          <p
            role="status"
            className={`mb-3 rounded-[var(--radius-sm)] px-3 py-2 text-caption ${
              outcome === 'success'
                ? 'bg-[var(--admin-success-soft)] text-[var(--admin-success)]'
                : 'bg-[var(--admin-danger-soft)] text-[var(--admin-danger)]'
            }`}
          >
            {outcome === 'success'
              ? '✓ הטופס הסתיים בהצלחה. מרעננים את פרטי ההזמנה…'
              : '✗ התשלום נכשל או בוטל. אפשר לנסות שוב.'}
          </p>
        ) : null}
        {paymentUrl && !outcome ? (
          <iframe
            src={paymentUrl}
            title="טופס תשלום מאובטח — מורנינג"
            className="h-[32rem] w-full rounded-[var(--radius-sm)] border border-[var(--admin-border)]"
          />
        ) : null}
      </Drawer>
    </>
  );
}
