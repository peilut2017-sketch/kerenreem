import { requireScreenPermission } from '@/lib/admin/auth';
import { getManyOrdersForPrint } from '@/lib/admin/print/print-data';
import { PrintSheet } from '@/components/admin/print/PrintSheet';
import { PrintToolbar } from '@/components/admin/print/PrintToolbar';
import { PackingSlipBody } from '@/components/admin/print/PackingSlipBody';
import { getSiteSettings } from '@/lib/data';

export const dynamic = 'force-dynamic';

/** [1.5] N תעודות משלוח — כל הזמנה על עמוד A4 נפרד (page-break-after ב-PrintSheet). */
export default async function BulkPackingSlipsPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  await requireScreenPermission('orders', 'view');
  const { ids } = await searchParams;
  const orderIds = (ids ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  const [orders, settings] = await Promise.all([getManyOrdersForPrint(orderIds), getSiteSettings()]);

  return (
    <>
      <PrintToolbar title={`${orders.length} תעודות משלוח`} backHref="/admin/orders" />
      {orders.map(({ order, items }) => (
        <PrintSheet key={order.id}>
          <PackingSlipBody order={order} items={items} contactAddress={settings.contact.address_he} />
        </PrintSheet>
      ))}
    </>
  );
}
