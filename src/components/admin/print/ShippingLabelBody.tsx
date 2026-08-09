import type { Order } from '@/lib/supabase/types';
import { trackingQrSvg } from '@/lib/admin/print/qr';

const ORG_NAME = 'מכון קרן רא״ם';

/**
 * [1.5] מדבקת משלוח — בלי מחיר, בלי תוכן פיננסי, בלי רשימת ספרים. רק
 * מה שהשליח/הדוור צריכים: נמען, כתובת, מעקב, שולח, הערה קצרה.
 */
export async function ShippingLabelBody({
  order,
  senderAddress,
}: {
  order: Order;
  senderAddress?: string;
}) {
  const address = order.shipping_address as Record<string, string> | null;
  const qr = order.tracking_url ? await trackingQrSvg(order.tracking_url) : null;

  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <p className="text-xs text-gray-500">הזמנה #{order.order_number}</p>
        <p className="mt-1 text-2xl font-bold leading-tight">{address?.recipient_name ?? order.contact_name}</p>
        {address ? (
          <p className="mt-1 text-lg leading-snug">
            {address.street} {address.house_number}
            {address.entrance ? ` כניסה ${address.entrance}` : ''}
            {address.floor ? ` · קומה ${address.floor}` : ''}
            {address.apartment ? ` · דירה ${address.apartment}` : ''}
            <br />
            {address.city}
            {address.zip ? ` ${address.zip}` : ''}
          </p>
        ) : null}
        {address?.phone ? (
          <p className="mt-1 text-lg" dir="ltr">
            {address.phone}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex items-end justify-between border-t-2 border-black pt-3">
        <div className="text-sm">
          {order.tracking_company ? <p className="font-semibold">{order.tracking_company}</p> : null}
          {order.tracking_number ? (
            <p dir="ltr" className="font-mono">
              {order.tracking_number}
            </p>
          ) : null}
          {order.courier_notes ? <p className="mt-1 max-w-[60mm] text-xs text-gray-700">{order.courier_notes}</p> : null}
        </div>
        {qr ? <div className="shrink-0" dangerouslySetInnerHTML={{ __html: qr }} /> : null}
      </div>

      <div className="mt-3 border-t border-gray-300 pt-2 text-xs text-gray-600">
        <p>שולח: {ORG_NAME}</p>
        {senderAddress ? <p>{senderAddress}</p> : null}
      </div>
    </div>
  );
}
