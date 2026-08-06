import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { Customer, Order, SavedBook } from '@/lib/supabase/types';

/**
 * שכבת חשבון הלקוח (פרק 4 במסמך האב). לקוח = משתמש auth עם שורת
 * customers ובלי profiles (ההפרדה של migration 23). הקריאות כאן עוברות
 * דרך ה-RLS של הלקוח — הוא רואה רק את שלו.
 *
 * ⚠️ הנחה A12: עד חיבור ספק SMS, ההתחברות היא בקישור חד-פעמי למייל
 * (Supabase email OTP — עובד ללא תצורה נוספת). שיוך הזמנות עבר נעשה
 * לפי המייל *המאומת* — הכתובת שקיבלה את אישורי ההזמנה — ולא לפי טלפון.
 * כשיחובר ספק SMS, OTP לטלפון נוסף כמסלול ראשי והשיוך עובר לטלפון
 * מאומת, כמפרט.
 */

export interface CustomerSession {
  userId: string;
  email: string | null;
  customer: Customer | null;
}

/** המשתמש המחובר בצד הלקוח — או null. אינו דורש profiles (זה צוות). */
export async function getCustomerSession(): Promise<CustomerSession | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;
  const email = (claims?.claims?.email as string | undefined) ?? null;

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  return { userId, email, customer: (customer as Customer | null) ?? null };
}

/**
 * יצירת רשומת הלקוח אחרי ההתחברות הראשונה + שיוך הזמנות אורח עם אותו
 * מייל מאומת (החשבון הפסיבי — תרשים 18). Idempotent: ריצה חוזרת לא
 * משנה דבר. service role: ללקוחות אין policy יצירה במכוון.
 */
export async function ensureCustomerRecord(session: CustomerSession): Promise<Customer | null> {
  if (session.customer) return session.customer;
  const service = createServiceClient();
  if (!service || !session.email) return null;

  // פרטי ההזמנה האחרונה עם המייל הזה — מקור השם והטלפון, בלי טופס נוסף
  const { data: lastOrder } = await service
    .from('orders')
    .select('contact_name, contact_phone')
    .eq('contact_email', session.email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const phone = lastOrder?.contact_phone ?? `pending:${session.userId}`;
  const { data: customer, error } = await service
    .from('customers')
    .upsert(
      {
        id: session.userId,
        phone,
        email: session.email,
        full_name: lastOrder?.contact_name ?? null,
      },
      { onConflict: 'id' },
    )
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('[commerce:account] ensure customer', error.message);
    return null;
  }

  // שיוך הזמנות העבר: רק הזמנות שהמייל *המאומת* הזה קיבל את אישוריהן
  const { error: claimError } = await service
    .from('orders')
    .update({ user_id: session.userId })
    .eq('contact_email', session.email)
    .is('user_id', null);
  if (claimError) console.error('[commerce:account] claim orders', claimError.message);

  return (customer as Customer | null) ?? null;
}

/** הזמנות הלקוח — דרך ה-RLS (orders_own_read: user_id = auth.uid()). */
export async function getMyOrders(): Promise<Order[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    console.error('[commerce:account] orders', error.message);
    return [];
  }
  return (data ?? []) as Order[];
}

export async function getMyOrderByNumber(orderNumber: number): Promise<Order | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('order_number', orderNumber)
    .maybeSingle();
  return (data as Order | null) ?? null;
}

export async function getMySavedBooks(): Promise<SavedBook[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.from('saved_books').select('*');
  return (data ?? []) as SavedBook[];
}
