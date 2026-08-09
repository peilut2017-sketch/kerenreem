import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { hashGuestToken } from './guest-token';
import type { Customer, CustomerAddress, CommerceDocument, Order, SavedBook } from '@/lib/supabase/types';

/**
 * שכבת חשבון הלקוח (פרק 4 במסמך האב). לקוח = משתמש auth עם שורת
 * customers ובלי profiles (ההפרדה של migration 23). הקריאות כאן עוברות
 * דרך ה-RLS של הלקוח — הוא רואה רק את שלו.
 *
 * [1.1] מנגנון Claim בטוח (סעיף 7 בסבב התיקונים, תרשים 18):
 * עוגן השיוך הוא *טוקן ההזמנה* — לא מזהה קשר לבדו. הזמנת המקור (שמטוקנה
 * התחיל ה-Claim) משויכת תמיד; הזמנות עבר משויכות רק בהתאמה כפולה — גם
 * הטלפון וגם המייל זהים לזהות המאומתת. התאמה חלקית ⇒ אין שיוך אוטומטי;
 * ההזמנה נשארת נגישה בטוקן שלה ואיש הצוות יכול לשייך ידנית. טלפונים
 * משותפים (קו משפחתי/כשר) הם תרחיש נפוץ בקהל — מספר לבדו אינו הוכחה.
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
 * יצירת רשומת הלקוח אחרי ההתחברות + ‏Claim בטוח (תרשים 18 המתוקן).
 * Idempotent: ריצה חוזרת לא משנה דבר. service role: ללקוחות אין policy
 * יצירה במכוון.
 *
 * claimToken — טוקן הזמנת המקור (מהמייל / עמוד המעקב / עמוד התודה):
 * מוכיח בעלות על אותה הזמנה. בלעדיו לא משויכת שום הזמנה אוטומטית —
 * אי-ודאות פירושה לא-ממזגים.
 */
export async function ensureCustomerRecord(
  session: CustomerSession,
  claimToken?: string | null,
): Promise<Customer | null> {
  const service = createServiceClient();
  if (!service || !session.email) return session.customer;

  // הזמנת המקור — רק אם הטוקן מוכיח אותה (hash מלא, לא ניחוש)
  let originOrder: {
    id: string;
    contact_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    user_id: string | null;
  } | null = null;
  if (claimToken) {
    const { data } = await service
      .from('orders')
      .select('id, contact_name, contact_phone, contact_email, user_id')
      .eq('guest_token_hash', hashGuestToken(claimToken))
      .eq('guest_token_revoked', false)
      .maybeSingle();
    originOrder = data ?? null;
  }

  let customer = session.customer;
  if (!customer) {
    const { data, error } = await service
      .from('customers')
      .upsert(
        {
          id: session.userId,
          // בלי הזמנת מקור מוכחת אין טלפון מאומת — נשאר ממתין להשלמה
          phone: originOrder?.contact_phone ?? `pending:${session.userId}`,
          email: session.email,
          full_name: originOrder?.contact_name ?? null,
        },
        { onConflict: 'id' },
      )
      .select('*')
      .maybeSingle();
    if (error) {
      console.error('[commerce:account] ensure customer', error.message);
      return null;
    }
    customer = (data as Customer | null) ?? null;
  }

  if (originOrder && !originOrder.user_id) {
    // שיוך הזמנת המקור — הטוקן הוכיח אותה
    await service
      .from('orders')
      .update({ user_id: session.userId })
      .eq('id', originOrder.id)
      .is('user_id', null);

    // הזמנות עבר: התאמה כפולה בלבד — גם הטלפון וגם המייל המאומת
    if (originOrder.contact_phone && originOrder.contact_email === session.email) {
      const { error: claimError } = await service
        .from('orders')
        .update({ user_id: session.userId })
        .eq('contact_email', session.email)
        .eq('contact_phone', originOrder.contact_phone)
        .is('user_id', null);
      if (claimError) console.error('[commerce:account] claim orders', claimError.message);
    }
  }

  return customer;
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

export interface OrderCoverInfo {
  coverImageUrl: string | null;
  itemCount: number;
}

/**
 * [1.6] כריכה ראשונה + מספר פריטים לכל הזמנה (ח.15) — לכרטיסי ההזמנות
 * באזור האישי, שהיו שורות טקסט בלבד. שני שלבים (order_items ואז books),
 * לא PostgREST embed — אותו עיקרון כמו שאר השאילתאות הכפולות במסמך הזה.
 */
export async function getMyOrderCovers(orderIds: string[]): Promise<Record<string, OrderCoverInfo>> {
  const supabase = await createClient();
  if (!supabase || orderIds.length === 0) return {};

  const { data: items } = await supabase
    .from('order_items')
    .select('order_id, book_id')
    .in('order_id', orderIds)
    .order('id', { ascending: true });
  const rows = (items ?? []) as { order_id: string; book_id: string | null }[];
  if (rows.length === 0) return {};

  const bookIds = [...new Set(rows.map((row) => row.book_id).filter((id): id is string => id != null))];
  const { data: books } =
    bookIds.length > 0
      ? await supabase.from('books').select('id, cover_image_url').in('id', bookIds)
      : { data: [] };
  const coverById = new Map(
    ((books ?? []) as { id: string; cover_image_url: string | null }[]).map((b) => [b.id, b.cover_image_url]),
  );

  const result: Record<string, OrderCoverInfo> = {};
  for (const row of rows) {
    const cover = row.book_id ? (coverById.get(row.book_id) ?? null) : null;
    const existing = result[row.order_id];
    if (!existing) {
      result[row.order_id] = { coverImageUrl: cover, itemCount: 1 };
    } else {
      existing.itemCount += 1;
      if (!existing.coverImageUrl && cover) existing.coverImageUrl = cover;
    }
  }
  return result;
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

/** [1.3] פנקס הכתובות — דרך ה-RLS (customer_addresses_owner). */
export async function getMyAddresses(): Promise<CustomerAddress[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('customer_addresses')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  return (data ?? []) as CustomerAddress[];
}

export async function getMySavedBooks(): Promise<SavedBook[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.from('saved_books').select('*');
  return (data ?? []) as SavedBook[];
}

export interface MyDocumentRow {
  document: CommerceDocument;
  orderNumber: number | null;
}

/**
 * [1.6] "המסמכים שלי" (ט.1) — דרך ה-RLS בלבד (documents_read:
 * can_manage_store() OR orders.user_id = auth.uid()), בלי service role.
 * מספר ההזמנה לתצוגה מגיע בשאילתה שנייה (אותו דפוס כמו getCustomerDetail).
 */
export async function getMyDocuments(): Promise<MyDocumentRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('status', 'created')
    .order('issued_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('[commerce:account] documents', error.message);
    return [];
  }
  const documents = (data ?? []) as CommerceDocument[];
  if (documents.length === 0) return [];

  const orderIds = [...new Set(documents.map((doc) => doc.order_id))];
  const { data: orders } = await supabase.from('orders').select('id, order_number').in('id', orderIds);
  const orderNumberById = new Map(
    ((orders ?? []) as { id: string; order_number: number }[]).map((row) => [row.id, row.order_number]),
  );

  return documents.map((document) => ({
    document,
    orderNumber: orderNumberById.get(document.order_id) ?? null,
  }));
}
