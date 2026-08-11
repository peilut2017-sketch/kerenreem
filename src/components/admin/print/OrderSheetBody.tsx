import { formatPrice } from '@/lib/commerce/pricing';
import {
  DOCUMENT_STATE_LABELS,
  FULFILLMENT_STATE_LABELS,
  ORDER_STATE_LABELS,
  PAYMENT_STATE_LABELS,
} from '@/components/admin/orders/labels';
import { toCdnUrl } from '@/lib/image-src';
import type { Order } from '@/lib/supabase/types';
import type { PrintItem } from '@/lib/admin/print/print-data';

/**
 * [1.5] דף הזמנה פנימי — תמונת ההזמנה המלאה לצוות. כאן כן מותר מחיר/
 * אמצעי תשלום/הנחה — בניגוד לתעודת המשלוח/מדבקה שנכנסות לחבילה.
 */
export function OrderSheetBody({ order, items }: { order: Order; items: PrintItem[] }) {
  const dateFmt = new Intl.DateTimeFormat('he-IL', { dateStyle: 'long', timeStyle: 'short' });
  const channelLabel = order.channel === 'web' ? 'מהאתר' : order.channel === 'phone' ? 'הזמנה טלפונית' : 'ידנית';
  const address = order.shipping_address as Record<string, string> | null;

  return (
    <div>
      <header className="mb-6 flex items-start justify-between border-b-2 border-black pb-4">
        <div>
          <h1 className="text-2xl font-bold">הזמנה #{order.order_number}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {order.placed_at ? dateFmt.format(new Date(order.placed_at)) : ''} · {channelLabel}
          </p>
        </div>
        <div className="text-left text-sm">
          <p className="font-semibold">{ORDER_STATE_LABELS[order.state] ?? order.state}</p>
          <p>תשלום: {PAYMENT_STATE_LABELS[order.payment_state] ?? order.payment_state}</p>
          <p>מסמך: {DOCUMENT_STATE_LABELS[order.document_state] ?? order.document_state}</p>
        </div>
      </header>

      <section className="mb-5 grid grid-cols-2 gap-6 text-sm">
        <div>
          <h2 className="mb-1.5 font-bold">לקוח</h2>
          <p>{order.contact_name}</p>
          <p dir="ltr" className="text-right">{order.contact_phone}</p>
          {order.contact_email ? <p dir="ltr" className="text-right">{order.contact_email}</p> : null}
        </div>
        <div>
          <h2 className="mb-1.5 font-bold">אספקה</h2>
          <p>
            {order.fulfillment_type === 'pickup' ? 'איסוף עצמי' : order.shipping_method_name_snapshot}
            {' · '}
            {FULFILLMENT_STATE_LABELS[order.fulfillment_state] ?? order.fulfillment_state}
          </p>
          {address ? (
            <p>
              {address.street} {address.house_number}
              {address.apartment ? `/${address.apartment}` : ''}, {address.city}
            </p>
          ) : null}
          {order.courier_notes ? <p className="text-gray-600">הערה לשליח: {order.courier_notes}</p> : null}
        </div>
      </section>

      {order.is_gift ? (
        <section className="mb-5 rounded border border-black px-3 py-2 text-sm">
          <strong>הזמנת מתנה</strong>
          {order.gift_recipient_name ? ` — עבור ${order.gift_recipient_name}` : ''}
          {order.gift_hide_prices ? ' · בלי מחירים בחבילה' : ''}
          {order.gift_message ? <p className="mt-1 italic">“{order.gift_message}”</p> : null}
        </section>
      ) : null}

      <table className="mb-5 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-right">
            <th className="py-1.5 pe-2 font-bold">כריכה</th>
            <th className="py-1.5 pe-2 font-bold">ספר</th>
            <th className="py-1.5 pe-2 font-bold">מק״ט</th>
            <th className="py-1.5 pe-2 text-center font-bold">כמות</th>
            <th className="py-1.5 ps-2 text-left font-bold">סה״כ</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-gray-300">
              <td className="py-1.5 pe-2">
                {item.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={toCdnUrl(item.coverUrl)} alt="" className="h-12 w-9 object-cover" />
                ) : null}
              </td>
              <td className="py-1.5 pe-2">{item.title_snapshot}</td>
              <td className="py-1.5 pe-2" dir="ltr">{item.sku_snapshot ?? '—'}</td>
              <td className="py-1.5 pe-2 text-center">{item.quantity}</td>
              <td className="py-1.5 ps-2 text-left">{formatPrice(Number(item.line_total ?? 0), 'he')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mb-5 ms-auto w-64 text-sm">
        <div className="flex justify-between py-0.5">
          <span>סכום ביניים</span>
          <span>{formatPrice(Number(order.subtotal), 'he')}</span>
        </div>
        {Number(order.discount_total) > 0 ? (
          <div className="flex justify-between py-0.5">
            <span>הנחה{order.coupon_code_snapshot ? ` (${order.coupon_code_snapshot})` : ''}</span>
            <span>−{formatPrice(Number(order.discount_total), 'he')}</span>
          </div>
        ) : null}
        <div className="flex justify-between py-0.5">
          <span>משלוח</span>
          <span>{formatPrice(Number(order.shipping_total), 'he')}</span>
        </div>
        <div className="flex justify-between border-t-2 border-black py-1 font-bold">
          <span>סה״כ</span>
          <span>{formatPrice(Number(order.total), 'he')}</span>
        </div>
      </section>

      {order.notes ? (
        <section className="text-sm">
          <strong>הערה: </strong>
          {order.notes}
        </section>
      ) : null}
    </div>
  );
}
