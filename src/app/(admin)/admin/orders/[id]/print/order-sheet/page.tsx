import { notFound } from 'next/navigation';
import { requireScreenPermission } from '@/lib/admin/auth';
import { getOrderForPrint } from '@/lib/admin/print/print-data';
import { PrintSheet } from '@/components/admin/print/PrintSheet';
import { PrintToolbar } from '@/components/admin/print/PrintToolbar';
import { OrderSheetBody } from '@/components/admin/print/OrderSheetBody';

export const dynamic = 'force-dynamic';

/**
 * [1.5] דף הזמנה פנימי — תמונת ההזמנה המלאה לצוות (§ מערך המסמכים,
 * "חובה לפתיחה"). כאן כן מותר מחיר/אמצעי תשלום/הנחה/הערות צוות — בניגוד
 * לתעודת המשלוח/מדבקה שנכנסות לחבילה. הרשאת store (כספים גלויים).
 */
export default async function OrderSheetPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireScreenPermission('orders', 'edit');
  const { id } = await params;
  const data = await getOrderForPrint(id);
  if (!data) notFound();

  return (
    <>
      <PrintToolbar title={`דף הזמנה פנימי — #${data.order.order_number}`} backHref={`/admin/orders/${data.order.id}`} />
      <PrintSheet>
        <OrderSheetBody order={data.order} items={data.items} />
      </PrintSheet>
    </>
  );
}
