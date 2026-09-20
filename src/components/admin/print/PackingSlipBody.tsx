import type { Order } from '@/lib/supabase/types';
import type { PrintItem } from '@/lib/admin/print/print-data';
import { formatPrice } from '@/lib/commerce/pricing';

const ORG_NAME = 'מכון קרן רא״ם';

/**
 * [1.5] גוף תעודת המשלוח — משותף לדף בודד ולהדפסה מרוכזת. במתנה עם
 * gift_hide_prices: בלי טור מחיר בכלל, לא רק בלי סיכום כספי.
 */
export function PackingSlipBody({
  order,
  items,
  contactAddress,
}: {
  order: Order;
  items: PrintItem[];
  contactAddress?: string;
}) {
  const showPrices = !(order.is_gift && order.gift_hide_prices);
  const address = order.shipping_address as Record<string, string> | null;

  return (
    <div>
      <header className="mb-6 flex items-start justify-between border-b-2 border-black pb-4">
        <div>
          <h1 className="text-xl font-bold">{ORG_NAME}</h1>
          {contactAddress ? <p className="text-sm text-gray-600">{contactAddress}</p> : null}
        </div>
        <div className="text-left">
          <p className="text-lg font-bold">הזמנה #{order.order_number}</p>
        </div>
      </header>

      <p className="mb-4">
        שלום {order.contact_name ?? ''},
        <br />
        תודה על הזמנתך ממכון קרן רא״ם.
      </p>

      <p className="mb-4 text-sm">
        <strong>נשלח אל: </strong>
        {order.fulfillment_type === 'pickup'
          ? 'איסוף עצמי'
          : address
            ? `${address.street} ${address.house_number}${address.apartment ? `/${address.apartment}` : ''}, ${address.city}`
            : ''}
      </p>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-right">
            <th className="py-1.5 pe-2 font-bold">ספר</th>
            <th className="py-1.5 pe-2 text-center font-bold">כמות</th>
            {showPrices ? <th className="py-1.5 ps-2 text-left font-bold">מחיר</th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-gray-300">
              <td className="py-1.5 pe-2">{item.title_snapshot}</td>
              <td className="py-1.5 pe-2 text-center">{item.quantity}</td>
              {showPrices ? (
                <td className="py-1.5 ps-2 text-left">
                  {formatPrice(Number(item.line_total ?? 0), 'he', { alwaysAgorot: true })}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>

      {order.is_gift && order.gift_message ? (
        <p className="mt-6 border-t border-gray-300 pt-4 text-sm italic">“{order.gift_message}”</p>
      ) : null}

      <p className="mt-8 text-center text-sm text-gray-600">בברכת התורה, {ORG_NAME}</p>
    </div>
  );
}
