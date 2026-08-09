import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/admin/auth';
import { getOrderForPrint } from '@/lib/admin/print/print-data';
import { PrintSheet } from '@/components/admin/print/PrintSheet';
import { PrintToolbar } from '@/components/admin/print/PrintToolbar';
import { PickupLabelBody } from '@/components/admin/print/PickupLabelBody';
import { readFormat } from '@/lib/admin/print/page-format';

export const dynamic = 'force-dynamic';

/** [1.5] מדבקת איסוף עצמי — 100×150 (?format=label) או A4 fallback. */
export default async function PickupLabelPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ format?: string }>;
}) {
  await requirePermission('store_view');
  const { id } = await params;
  const { format } = await searchParams;
  const data = await getOrderForPrint(id);
  if (!data) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';

  return (
    <>
      <PrintToolbar
        title={`מדבקת איסוף — #${data.order.order_number}`}
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
        <PickupLabelBody order={data.order} items={data.items} adminUrl={`${siteUrl}/admin/orders/${data.order.id}`} />
      </PrintSheet>
    </>
  );
}
