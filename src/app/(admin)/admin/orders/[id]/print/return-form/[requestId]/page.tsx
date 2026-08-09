import { notFound } from 'next/navigation';
import { requireScreenPermission } from '@/lib/admin/auth';
import { getOrderForPrint, getServiceRequestForPrint } from '@/lib/admin/print/print-data';
import { PrintSheet } from '@/components/admin/print/PrintSheet';
import { PrintToolbar } from '@/components/admin/print/PrintToolbar';
import { ReturnFormBody } from '@/components/admin/print/ReturnFormBody';
import { getSiteSettings } from '@/lib/data';

export const dynamic = 'force-dynamic';

/** [1.5] טופס החזרה — לפי בקשת שירות ספציפית (kind='return'), לא כל הזמנה. */
export default async function ReturnFormPrintPage({
  params,
}: {
  params: Promise<{ id: string; requestId: string }>;
}) {
  await requireScreenPermission('orders', 'view');
  const { id, requestId } = await params;
  const [data, request, settings] = await Promise.all([
    getOrderForPrint(id),
    getServiceRequestForPrint(requestId),
    getSiteSettings(),
  ]);
  if (!data || !request || request.order_id !== id || request.kind !== 'return') notFound();

  return (
    <>
      <PrintToolbar title={`טופס החזרה — #${data.order.order_number}`} backHref={`/admin/orders/${id}`} />
      <PrintSheet>
        <ReturnFormBody order={data.order} request={request} returnAddress={settings.contact.address_he} />
      </PrintSheet>
    </>
  );
}
