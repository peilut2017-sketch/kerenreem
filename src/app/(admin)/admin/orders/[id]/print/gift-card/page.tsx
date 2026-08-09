import { notFound } from 'next/navigation';
import { requireScreenPermission } from '@/lib/admin/auth';
import { getOrderForPrint } from '@/lib/admin/print/print-data';
import { PrintSheet } from '@/components/admin/print/PrintSheet';
import { PrintToolbar } from '@/components/admin/print/PrintToolbar';
import { GiftCardBody } from '@/components/admin/print/GiftCardBody';

export const dynamic = 'force-dynamic';

/** [1.5] הקדשה/כרטיס מתנה — A6, רק להזמנת מתנה. */
export default async function GiftCardPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireScreenPermission('orders', 'view');
  const { id } = await params;
  const data = await getOrderForPrint(id);
  if (!data || !data.order.is_gift) notFound();

  return (
    <>
      <PrintToolbar title={`הקדשה — #${data.order.order_number}`} backHref={`/admin/orders/${data.order.id}`} />
      <PrintSheet format="a6">
        <GiftCardBody order={data.order} />
      </PrintSheet>
    </>
  );
}
