import type { Order } from '@/lib/supabase/types';
import type { ServiceRequestRow } from '@/lib/commerce/service-requests';
import { trackingQrSvg } from '@/lib/admin/print/qr';

const ORG_NAME = 'מכון קרן רא״ם';

/** [1.5] קוד קריא לזיהוי בקשת ההחזרה — לא ה-UUID הגולמי. */
export function returnRequestCode(order: Order, request: ServiceRequestRow): string {
  const dateCode = new Date(request.created_at).toISOString().slice(0, 10).replace(/-/g, '');
  return `RMA-${order.order_number}-${dateCode}`;
}

/**
 * [1.5] טופס החזרה — מלווה חבילה חוזרת. כשהחבילה מגיעה, העובד סורק/
 * מקליד את הקוד ומגיע ישר לבקשת ההחזרה (service_requests).
 */
export async function ReturnFormBody({
  order,
  request,
  returnAddress,
}: {
  order: Order;
  request: ServiceRequestRow;
  returnAddress?: string;
}) {
  const code = returnRequestCode(order, request);
  const qr = await trackingQrSvg(code);

  return (
    <div>
      <header className="mb-6 flex items-start justify-between border-b-2 border-black pb-4">
        <div>
          <h1 className="text-xl font-bold">טופס החזרה</h1>
          <p className="mt-1 text-sm text-gray-600">הזמנה #{order.order_number}</p>
        </div>
        <div className="text-left">
          <p className="font-mono text-lg font-bold" dir="ltr">{code}</p>
          <div className="mt-1" dangerouslySetInnerHTML={{ __html: qr }} />
        </div>
      </header>

      <section className="mb-5 text-sm">
        <p>
          <strong>שם: </strong>
          {order.contact_name}
        </p>
        {order.contact_phone ? (
          <p dir="ltr" className="text-right">
            <strong className="text-left">טלפון: </strong>
            {order.contact_phone}
          </p>
        ) : null}
      </section>

      <table className="mb-5 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-right">
            <th className="py-1.5 pe-2 font-bold">ספר</th>
            <th className="py-1.5 text-center font-bold">כמות מאושרת להחזרה</th>
          </tr>
        </thead>
        <tbody>
          {(request.items ?? []).map((item) => (
            <tr key={item.bookId} className="border-b border-gray-300">
              <td className="py-1.5 pe-2">{item.title}</td>
              <td className="py-1.5 text-center">{item.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {request.reason ? (
        <p className="mb-5 text-sm">
          <strong>סיבת ההחזרה: </strong>
          {request.reason}
        </p>
      ) : null}

      <section className="mb-5 rounded border border-black px-3 py-2.5 text-sm">
        <p className="font-bold">הוראות</p>
        <p className="mt-1">ארזו את הספרים המאושרים באריזה מקורית ככל האפשר, וצרפו טופס זה לחבילה.</p>
      </section>

      <section className="text-sm">
        <p className="font-bold">כתובת להחזרה</p>
        <p>{ORG_NAME}</p>
        {returnAddress ? <p>{returnAddress}</p> : null}
      </section>
    </div>
  );
}
