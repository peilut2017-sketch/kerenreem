import { requireScreenPermission } from '@/lib/admin/auth';
import { PaymentReturnSignal } from '@/components/admin/orders/PaymentReturnSignal';

export const dynamic = 'force-dynamic';

/**
 * [1.5] יעד ה-successUrl/failureUrl של גביית האשראי בניהול (CardPaymentDrawer) —
 * נטען *בתוך* ה-iframe בעמוד ההזמנה, לא כעמוד עצמאי. מחוץ ל-(dashboard)
 * בכוונה (כמו נתיבי ההדפסה): בלי AdminNav/Sidebar, רק ההודעה הקצרה הזו.
 * frame-ancestors/X-Frame-Options מוקלים ל-'self' רק לנתיב המדויק הזה
 * (ראו next.config.ts) — שאר הניהול נשאר חסום-הטמעה כרגיל.
 */
export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ outcome?: string }>;
}) {
  await requireScreenPermission('orders', 'view');
  const { outcome } = await searchParams;
  const success = outcome === 'success';

  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-cream p-6 text-center">
      <div>
        <p aria-hidden="true" className="text-4xl">
          {success ? '✓' : '✗'}
        </p>
        <p className="mt-3 text-base font-semibold text-ink">
          {success ? 'התשלום התקבל בהצלחה.' : 'התשלום נכשל או בוטל.'}
        </p>
        <p className="mt-1 text-sm text-muted">אפשר לסגור את החלון הזה.</p>
      </div>
      <PaymentReturnSignal outcome={success ? 'success' : 'failure'} />
    </div>
  );
}
