import { requirePermission } from '@/lib/admin/auth';
import { createClient } from '@/lib/supabase/server';
import { AdminHeader } from '@/components/admin/AdminList';
import {
  ManualOrderForm,
  type ManualOrderBook,
  type ManualShippingMethod,
} from '@/components/admin/orders/ManualOrderForm';

export const dynamic = 'force-dynamic';

/**
 * הזמנה טלפונית (פרק 9.6): הערוץ של הלקוחות שאין להם אינטרנט — הצוות
 * קולט בשיחה. מחירים מהקטלוג, מלאי נשמר, והמשך הגבייה מעמוד ההזמנה
 * (קישור תשלום במייל / תשלום חיצוני).
 */
export default async function NewManualOrderPage() {
  await requirePermission('store');
  const supabase = await createClient();

  const [booksRes, methodsRes] = supabase
    ? await Promise.all([
        supabase
          .from('books')
          .select('id, title_he, sku, price, stock_quantity, is_purchasable, is_stock_managed')
          .eq('is_purchasable', true)
          .order('title_he'),
        supabase
          .from('shipping_methods')
          .select('id, name_he, kind, price, active')
          .eq('active', true)
          .neq('kind', 'pickup')
          .order('sort_order'),
      ])
    : [{ data: [] }, { data: [] }];

  const books: ManualOrderBook[] = (booksRes.data ?? []).map((book) => ({
    id: book.id,
    title: book.title_he,
    sku: book.sku,
    price: book.price != null ? Number(book.price) : null,
    available: book.is_stock_managed === false ? null : (book.stock_quantity ?? 0),
  }));
  const methods: ManualShippingMethod[] = (methodsRes.data ?? []).map((method) => ({
    id: method.id,
    name: method.name_he,
    price: Number(method.price),
  }));

  return (
    <>
      <AdminHeader
        title="הזמנה טלפונית חדשה"
        description="קליטת הזמנה בשיחה: פריטים מהקטלוג, פרטי לקוח ואספקה. המחירים תמיד מהקטלוג — אין הקלדת מחיר ידנית."
        action={{ href: '/admin/orders', label: 'חזרה להזמנות', icon: 'back' }}
      />
      <ManualOrderForm books={books} methods={methods} />
    </>
  );
}
