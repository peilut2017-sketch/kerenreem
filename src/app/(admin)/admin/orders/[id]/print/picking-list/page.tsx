import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/admin/auth';
import { getOrderForPrint } from '@/lib/admin/print/print-data';
import { PrintSheet } from '@/components/admin/print/PrintSheet';
import { PrintToolbar } from '@/components/admin/print/PrintToolbar';

export const dynamic = 'force-dynamic';

/**
 * [1.5] רשימת ליקוט בודדת — איסוף הספרים מהמדפים. בלי מחיר ובלי פרטי
 * לקוח כספיים: הרשאת store_view מספיקה, כמו PickingPanel. ממוינת לפי
 * מיקום מדף כדי שהמלקט לא ירוץ הלוך ושוב במחסן.
 */
export default async function PickingListPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('store_view');
  const { id } = await params;
  const data = await getOrderForPrint(id);
  if (!data) notFound();
  const { order, items } = data;

  const sorted = [...items].sort((a, b) =>
    (a.stockLocation ?? '￿').localeCompare(b.stockLocation ?? '￿', 'he'),
  );

  return (
    <>
      <PrintToolbar title={`רשימת ליקוט — #${order.order_number}`} backHref={`/admin/orders/${order.id}`} />
      <PrintSheet>
        <header className="mb-6 border-b-2 border-black pb-3">
          <h1 className="text-2xl font-bold">רשימת ליקוט</h1>
          <p className="mt-1 text-sm text-gray-600">הזמנה #{order.order_number}</p>
        </header>

        <table className="w-full border-collapse text-base">
          <thead>
            <tr className="border-b-2 border-black text-right">
              <th className="w-24 py-2 pe-2 font-bold">מיקום</th>
              <th className="w-28 py-2 pe-2 font-bold">מק״ט</th>
              <th className="py-2 pe-2 font-bold">ספר</th>
              <th className="w-16 py-2 pe-2 text-center font-bold">כמות</th>
              <th className="w-14 py-2 text-center font-bold">✓</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <tr key={item.id} className="border-b border-gray-300">
                <td className="py-2.5 pe-2 font-mono">{item.stockLocation ?? '—'}</td>
                <td className="py-2.5 pe-2" dir="ltr">{item.sku_snapshot ?? '—'}</td>
                <td className="py-2.5 pe-2">{item.title_snapshot}</td>
                <td className="py-2.5 pe-2 text-center font-bold">{item.quantity}</td>
                <td className="py-2.5 text-center">
                  <span className="inline-block h-5 w-5 border-2 border-black" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </PrintSheet>
    </>
  );
}
