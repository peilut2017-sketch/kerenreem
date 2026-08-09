import type { Order } from '@/lib/supabase/types';
import type { PrintItem } from '@/lib/admin/print/print-data';
import { trackingQrSvg } from '@/lib/admin/print/qr';

/**
 * [1.5] מדבקת איסוף עצמי — לא מדבקת משלוח מלאה. המטרה: שכשהלקוח מגיע,
 * לא צריך לחפש בין עשרות שקיות. QR פותח את עמוד ההזמנה באדמין לעובד.
 */
export async function PickupLabelBody({
  order,
  items,
  adminUrl,
}: {
  order: Order;
  items: PrintItem[];
  adminUrl: string;
}) {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const qr = await trackingQrSvg(adminUrl);
  const readyDate = new Intl.DateTimeFormat('he-IL', { dateStyle: 'short' }).format(new Date(order.updated_at));

  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <p className="text-xs text-gray-500">הזמנה #{order.order_number}</p>
        <p className="mt-1 text-2xl font-bold leading-tight">{order.contact_name}</p>
        <p className="mt-1 text-lg">
          {itemCount} פריט{itemCount === 1 ? '' : 'ים'}
        </p>
        {order.contact_phone ? (
          <p className="mt-1 text-lg" dir="ltr">
            {order.contact_phone}
          </p>
        ) : null}
      </div>
      <div className="mt-4 flex items-end justify-between border-t-2 border-black pt-3">
        <p className="text-sm">
          מוכן לאיסוף מ־
          <br />
          <span className="font-semibold">{readyDate}</span>
        </p>
        <div className="shrink-0" dangerouslySetInnerHTML={{ __html: qr }} />
      </div>
    </div>
  );
}
