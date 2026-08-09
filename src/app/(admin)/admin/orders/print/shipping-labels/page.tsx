import { requireScreenPermission } from '@/lib/admin/auth';
import { getManyOrdersForPrint } from '@/lib/admin/print/print-data';
import { PrintSheet } from '@/components/admin/print/PrintSheet';
import { PrintToolbar } from '@/components/admin/print/PrintToolbar';
import { ShippingLabelBody } from '@/components/admin/print/ShippingLabelBody';
import { readFormat } from '@/lib/admin/print/page-format';
import { getSiteSettings } from '@/lib/data';

export const dynamic = 'force-dynamic';

/** [1.5] N מדבקות משלוח — כל הזמנה במדבקה/עמוד נפרד. */
export default async function BulkShippingLabelsPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; format?: string }>;
}) {
  await requireScreenPermission('orders', 'view');
  const { ids, format } = await searchParams;
  const orderIds = (ids ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  const [orders, settings] = await Promise.all([getManyOrdersForPrint(orderIds), getSiteSettings()]);
  const printFormat = readFormat(format);

  return (
    <>
      <PrintToolbar
        title={`${orders.length} מדבקות משלוח`}
        backHref="/admin/orders"
        extra={
          <>
            <span>פורמט</span>
            <div className="flex items-center gap-2">
              <a href={`?ids=${ids ?? ''}&format=label`}>
                <button type="button">100×150 (מדבקה)</button>
              </a>
              <a href={`?ids=${ids ?? ''}&format=a4`}>
                <button type="button">A4</button>
              </a>
            </div>
          </>
        }
      />
      {orders.map(({ order }) => (
        <PrintSheet key={order.id} format={printFormat}>
          <ShippingLabelBody order={order} senderAddress={settings.contact.address_he} />
        </PrintSheet>
      ))}
    </>
  );
}
