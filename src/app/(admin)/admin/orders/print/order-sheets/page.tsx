import { requireScreenPermission } from '@/lib/admin/auth';
import { getManyOrdersForPrint } from '@/lib/admin/print/print-data';
import { PrintSheet } from '@/components/admin/print/PrintSheet';
import { PrintToolbar } from '@/components/admin/print/PrintToolbar';
import { OrderSheetBody } from '@/components/admin/print/OrderSheetBody';

export const dynamic = 'force-dynamic';

/** [1.5] N דפי הזמנה פנימיים — הרשאת store (כספים גלויים). */
export default async function BulkOrderSheetsPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  await requireScreenPermission('orders', 'edit');
  const { ids } = await searchParams;
  const orderIds = (ids ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  const orders = await getManyOrdersForPrint(orderIds);

  return (
    <>
      <PrintToolbar title={`${orders.length} דפי הזמנה`} backHref="/admin/orders" />
      {orders.map(({ order, items }) => (
        <PrintSheet key={order.id}>
          <OrderSheetBody order={order} items={items} />
        </PrintSheet>
      ))}
    </>
  );
}
