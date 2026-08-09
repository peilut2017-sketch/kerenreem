import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/admin/auth';
import { getOrderForPrint } from '@/lib/admin/print/print-data';
import { PrintSheet } from '@/components/admin/print/PrintSheet';
import { PrintToolbar } from '@/components/admin/print/PrintToolbar';
import { PackingSlipBody } from '@/components/admin/print/PackingSlipBody';
import { getSiteSettings } from '@/lib/data';

export const dynamic = 'force-dynamic';

/**
 * [1.5] תעודת משלוח (Packing Slip) — נכנסת לתוך החבילה. ממותגת אבל
 * פשוטה, בלי שום פירוט סליקה/הנחה/אמצעי תשלום. הזמנת מתנה עם
 * gift_hide_prices מסתירה גם את המחירים — לא רק "בלי חשבונית".
 */
export default async function PackingSlipPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('store_view');
  const { id } = await params;
  const [data, settings] = await Promise.all([getOrderForPrint(id), getSiteSettings()]);
  if (!data) notFound();

  return (
    <>
      <PrintToolbar title={`תעודת משלוח — #${data.order.order_number}`} backHref={`/admin/orders/${data.order.id}`} />
      <PrintSheet>
        <PackingSlipBody order={data.order} items={data.items} contactAddress={settings.contact.address_he} />
      </PrintSheet>
    </>
  );
}
