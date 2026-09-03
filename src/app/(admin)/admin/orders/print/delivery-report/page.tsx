import { requireScreenPermission } from '@/lib/admin/auth';
import { getManyOrdersForPrint } from '@/lib/admin/print/print-data';
import { PrintSheet } from '@/components/admin/print/PrintSheet';
import { PrintToolbar } from '@/components/admin/print/PrintToolbar';

import { formatAdminDate } from '@/lib/admin/reporting/format';
export const dynamic = 'force-dynamic';

/**
 * [1.5] דוח מסירה לשליח — כל החבילות שנמסרות יחד ביום נתון, עם שורת
 * חתימה/אישור מסירה בתחתית להשלמה ידנית (עדיין אין אינטגרציית שילוח).
 */
export default async function DeliveryReportPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  await requireScreenPermission('orders', 'view');
  const { ids } = await searchParams;
  const orderIds = (ids ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  const orders = await getManyOrdersForPrint(orderIds);
  const dateFmt = (value: string | number | Date) => formatAdminDate(value, 'long');

  return (
    <>
      <PrintToolbar title={`מסירת משלוחים — ${orders.length} חבילות`} backHref="/admin/orders" />
      <PrintSheet>
        <header className="mb-6 border-b-2 border-black pb-3">
          <h1 className="text-2xl font-bold">מסירת משלוחים</h1>
          <p className="mt-1 text-sm text-gray-600">{dateFmt(new Date())}</p>
        </header>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black text-right">
              <th className="py-2 pe-2 font-bold">הזמנה</th>
              <th className="py-2 pe-2 font-bold">לקוח</th>
              <th className="py-2 pe-2 font-bold">חברת משלוחים</th>
              <th className="py-2 font-bold">מספר מעקב</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(({ order }) => (
              <tr key={order.id} className="border-b border-gray-300">
                <td className="py-2 pe-2 font-semibold">#{order.order_number}</td>
                <td className="py-2 pe-2">{order.contact_name}</td>
                <td className="py-2 pe-2">{order.tracking_company ?? '—'}</td>
                <td className="py-2 font-mono" dir="ltr">{order.tracking_number ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-4 font-bold">סה״כ: {orders.length} חבילות</p>

        <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
          <div>
            <p className="mb-8">חתימת המוסר:</p>
            <div className="border-t border-black" />
          </div>
          <div>
            <p className="mb-8">חתימת השליח (אישור קבלה):</p>
            <div className="border-t border-black" />
          </div>
        </div>
      </PrintSheet>
    </>
  );
}
