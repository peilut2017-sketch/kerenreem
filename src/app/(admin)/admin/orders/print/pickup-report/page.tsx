import { requireScreenPermission } from '@/lib/admin/auth';
import { getPickupQueue } from '@/lib/admin/print/print-data';
import { PrintSheet } from '@/components/admin/print/PrintSheet';
import { PrintToolbar } from '@/components/admin/print/PrintToolbar';

import { formatAdminDate } from '@/lib/admin/reporting/format';
export const dynamic = 'force-dynamic';

const STALE_DAYS = 3;

/**
 * [1.5] דוח איסופים — הזמנות שממתינות לאיסוף, ממוינות לפי הזמן שהן
 * מחכות. מסומנות ⚠ מעבר ל-STALE_DAYS, כדי לזהות הזמנות ששכחו מהן.
 */
export default async function PickupReportPrintPage() {
  await requireScreenPermission('orders', 'view');
  const orders = await getPickupQueue();
  const now = new Date().getTime();
  const dateFmt = (value: string | number | Date) => formatAdminDate(value, 'date');

  return (
    <>
      <PrintToolbar title="דוח איסופים" backHref="/admin/orders" />
      <PrintSheet>
        <header className="mb-6 border-b-2 border-black pb-3">
          <h1 className="text-2xl font-bold">הזמנות ממתינות לאיסוף</h1>
          <p className="mt-1 text-sm text-gray-600">
            {dateFmt(new Date())} · {orders.length} הזמנות
          </p>
        </header>

        {orders.length === 0 ? (
          <p className="text-sm text-gray-600">אין הזמנות שממתינות לאיסוף כרגע.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-black text-right">
                <th className="py-2 pe-2 font-bold">הזמנה</th>
                <th className="py-2 pe-2 font-bold">לקוח</th>
                <th className="py-2 pe-2 font-bold">טלפון</th>
                <th className="py-2 pe-2 font-bold">מוכן מאז</th>
                <th className="py-2 text-center font-bold">מצב</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const daysWaiting = Math.floor((now - new Date(order.updated_at).getTime()) / 86_400_000);
                const stale = daysWaiting >= STALE_DAYS;
                return (
                  <tr key={order.id} className="border-b border-gray-300">
                    <td className="py-2 pe-2 font-semibold">#{order.order_number}</td>
                    <td className="py-2 pe-2">{order.contact_name}</td>
                    <td className="py-2 pe-2" dir="ltr">{order.contact_phone}</td>
                    <td className="py-2 pe-2">{dateFmt(new Date(order.updated_at))}</td>
                    <td className="py-2 text-center">{stale ? '⚠ לא נאסף' : 'מוכן'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </PrintSheet>
    </>
  );
}
