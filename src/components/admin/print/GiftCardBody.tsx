import type { Order } from '@/lib/supabase/types';

/**
 * [1.5] הקדשה/כרטיס מתנה — עיצוב אחד קבוע ומכובד (לא בחירה מרובת
 * תבניות), A6, נפרד מתעודת המשלוח. רק להזמנת מתנה עם הודעה.
 */
export function GiftCardBody({ order }: { order: Order }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="text-xs tracking-[0.3em] text-gray-500">מכון קרן רא״ם</div>
      <div className="h-px w-16 bg-gray-300" />
      {order.gift_recipient_name ? (
        <p className="font-serif text-xl">ל{order.gift_recipient_name} היקר/ה,</p>
      ) : null}
      <p className="whitespace-pre-line font-serif text-lg leading-relaxed">{order.gift_message}</p>
      <div className="h-px w-16 bg-gray-300" />
    </div>
  );
}
