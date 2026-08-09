import { notFound } from 'next/navigation';
import { requireScreenPermission } from '@/lib/admin/auth';
import { getOrderForPrint } from '@/lib/admin/print/print-data';
import { PrintSheet } from '@/components/admin/print/PrintSheet';
import { PrintToolbar } from '@/components/admin/print/PrintToolbar';
import { ShippingLabelBody } from '@/components/admin/print/ShippingLabelBody';
import { readFormat } from '@/lib/admin/print/page-format';
import { getSiteSettings } from '@/lib/data';

export const dynamic = 'force-dynamic';

/** [1.5] מדבקת משלוח — 100×150 (?format=label) או A4 fallback (ברירת מחדל). */
export default async function ShippingLabelPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ format?: string }>;
}) {
  await requireScreenPermission('orders', 'view');
  const { id } = await params;
  const { format } = await searchParams;
  const [data, settings] = await Promise.all([getOrderForPrint(id), getSiteSettings()]);
  if (!data) notFound();

  return (
    <>
      <PrintToolbar
        title={`מדבקת משלוח — #${data.order.order_number}`}
        backHref={`/admin/orders/${data.order.id}`}
        extra={
          <>
            <span>פורמט</span>
            <div className="flex items-center gap-2">
              <a href="?format=label">
                <button type="button">100×150 (מדבקה)</button>
              </a>
              <a href="?format=a4">
                <button type="button">A4</button>
              </a>
            </div>
          </>
        }
      />
      <PrintSheet format={readFormat(format)}>
        <ShippingLabelBody order={data.order} senderAddress={settings.contact.address_he} />
      </PrintSheet>
    </>
  );
}
