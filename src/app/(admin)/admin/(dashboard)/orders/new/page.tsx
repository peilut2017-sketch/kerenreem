import { requireScreenPermission } from '@/lib/admin/auth';
import { createClient } from '@/lib/supabase/server';
import { AdminHeader } from '@/components/admin/AdminList';
import { getEffectivePrice } from '@/lib/commerce/pricing';
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
  await requireScreenPermission('orders', 'edit');
  const supabase = await createClient();

  const [booksRes, methodsRes] = supabase
    ? await Promise.all([
        supabase
          .from('books')
          .select(
            'id, title_he, sku, price, sale_price, sale_starts_at, sale_ends_at, sale_name_he, stock_quantity, is_purchasable, is_stock_managed',
          )
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

  // [1.4] "המחיר בהזמנה הטלפונית שונה מהמחיר שנגבה" — הטופס שלף price
  // בלבד בלי sale_price/sale_starts_at/sale_ends_at, כך שעל ספר במבצע
  // הצוות הקריא ללקוח מחיר מלא בעוד השרת (getEffectivePrice, אותה
  // הפונקציה שמשמשת את הקטלוג הציבורי) חייב במחיר המבצע בפועל.
  const books: ManualOrderBook[] = (booksRes.data ?? []).map((book) => {
    const effective = getEffectivePrice(
      {
        price: book.price != null ? Number(book.price) : null,
        sale_price: book.sale_price != null ? Number(book.sale_price) : null,
        sale_starts_at: book.sale_starts_at,
        sale_ends_at: book.sale_ends_at,
        sale_name_he: book.sale_name_he,
        sale_name_en: null,
      },
      'he',
    );
    return {
      id: book.id,
      title: book.title_he,
      sku: book.sku,
      price: effective?.amount ?? null,
      originalPrice: effective?.onSale ? effective.originalAmount : null,
      saleName: effective?.onSale ? effective.saleName : null,
      available: book.is_stock_managed === false ? null : (book.stock_quantity ?? 0),
    };
  });
  const methods: ManualShippingMethod[] = (methodsRes.data ?? []).map((method) => ({
    id: method.id,
    name: method.name_he,
    price: Number(method.price),
  }));

  return (
    <>
      <AdminHeader
        title="הזמנה טלפונית חדשה"
        description="קליטת הזמנה בשיחה: פריטים מהקטלוג, פרטי לקוח ואספקה. המחירים מהקטלוג — למעט ספר בלי מחיר מוגדר, שם ניתן להקליד מחיר לפריט עצמו."
        action={{ href: '/admin/orders', label: 'חזרה להזמנות', icon: 'back' }}
      />
      <ManualOrderForm books={books} methods={methods} />
    </>
  );
}
