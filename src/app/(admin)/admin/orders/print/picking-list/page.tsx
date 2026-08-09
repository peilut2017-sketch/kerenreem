import { requirePermission } from '@/lib/admin/auth';
import { getManyOrdersForPrint } from '@/lib/admin/print/print-data';
import { PrintSheet } from '@/components/admin/print/PrintSheet';
import { PrintToolbar } from '@/components/admin/print/PrintToolbar';

export const dynamic = 'force-dynamic';

/**
 * [1.5] ליקוט מרוכז — עשרות הזמנות בבוקר לא הופכות לעשרות דפים נפרדים
 * שעוברים דף-דף; המערכת מאחדת: "אבודרהם — 14 עותקים", ממוינת לפי מיקום
 * מדף, כדי שהמלקט עובר במחסן פעם אחת ולא הלוך ושוב.
 */
export default async function BulkPickingListPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  await requirePermission('store_view');
  const { ids } = await searchParams;
  const orderIds = (ids ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  const orders = await getManyOrdersForPrint(orderIds);

  const totals = new Map<
    string,
    { title: string; sku: string | null; location: string | null; quantity: number }
  >();
  for (const { items } of orders) {
    for (const item of items) {
      const key = item.book_id ?? item.id;
      const existing = totals.get(key);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        totals.set(key, {
          title: item.title_snapshot ?? '',
          sku: item.sku_snapshot,
          location: item.stockLocation,
          quantity: item.quantity,
        });
      }
    }
  }
  const rows = [...totals.values()].sort((a, b) =>
    (a.location ?? '￿').localeCompare(b.location ?? '￿', 'he'),
  );

  return (
    <>
      <PrintToolbar title={`ליקוט מרוכז — ${orders.length} הזמנות`} backHref="/admin/orders" />
      <PrintSheet>
        <header className="mb-6 border-b-2 border-black pb-3">
          <h1 className="text-2xl font-bold">ליקוט מרוכז</h1>
          <p className="mt-1 text-sm text-gray-600">
            {orders.length} הזמנות: {orders.map((o) => `#${o.order.order_number}`).join(', ')}
          </p>
        </header>

        <table className="w-full border-collapse text-base">
          <thead>
            <tr className="border-b-2 border-black text-right">
              <th className="w-24 py-2 pe-2 font-bold">מיקום</th>
              <th className="w-28 py-2 pe-2 font-bold">מק״ט</th>
              <th className="py-2 pe-2 font-bold">ספר</th>
              <th className="w-24 py-2 pe-2 text-center font-bold">סה״כ יחידות</th>
              <th className="w-14 py-2 text-center font-bold">✓</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.title + (row.sku ?? '')} className="border-b border-gray-300">
                <td className="py-2.5 pe-2 font-mono">{row.location ?? '—'}</td>
                <td className="py-2.5 pe-2" dir="ltr">{row.sku ?? '—'}</td>
                <td className="py-2.5 pe-2">{row.title}</td>
                <td className="py-2.5 pe-2 text-center text-lg font-bold">{row.quantity}</td>
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
