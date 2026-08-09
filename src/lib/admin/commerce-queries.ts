import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type {
  CommerceDocument,
  InventoryLevel,
  NotificationLogEntry,
  Order,
  OrderEvent,
  OrderItem,
  Payment,
} from '@/lib/supabase/types';
import type { ServiceRequestRow } from '@/lib/commerce/service-requests';

/**
 * שאילתות הצוות למסכי המסחר — דרך ה-session client, תחת ה-RLS של
 * הצוות (orders_own_read עם can_edit, ‏payments_staff_read וכו').
 * אין כאן service role: מה שהצוות רואה הוא מה שה-RLS מתיר.
 */

export interface OrdersFilter {
  q?: string;
  state?: string;
  payment?: string;
  fulfillment?: string;
  view?: string;
  /** [1.4] עימוד — מחרוזת (מגיע מ-searchParams), 1 = עמוד ראשון */
  page?: string;
}

export const ORDERS_PAGE_SIZE = 50;

export interface OrdersListResult {
  orders: Order[];
  /** סה״כ תואמים לסינון, לצורך "עמוד X מתוך Y" — null אם נכשלה הספירה */
  total: number | null;
  page: number;
  pageSize: number;
  /** [1.4] כשל DB היה נבלע ל-[] וזהה חזותית ל"אין תוצאות" — עכשיו מדווח בנפרד */
  error: boolean;
}

/**
 * התצוגות השמורות (פרק 9.3) — שם ← תנאי סינון.
 * [1.4] לכל תצוגה יש עכשיו מפתח view משלה (גם כשהסינון האמיתי הוא
 * state/payment/fulfillment) — listOrders מתעלם ממנו בשקט כשאינו אחד
 * מהערכים שהוא מטפל בהם במיוחד, אבל הוא הופך את זיהוי "התצוגה
 * הפעילה" להשוואה ישירה אחת במקום התאמה חלקית לפי state+payment בלבד
 * (ששכחה את ציר האספקה — צ'יפ "בהכנה" נדלק גם ב-fulfillment=shipped)
 * ומבטלת את הצורך ב"הסרת המפתח כשהתצוגה כבר פעילה", שגרמה ללחיצה על
 * צ'יפ פעיל לבטל את הסימון שלו בלי לבטל את הסינון עצמו.
 *
 * [1.5] pending_payment עבר מ-payment=pending+state=pending (AND כפול)
 * ל-view ייעודי: הזמנה שסטטוס ה-state שלה קודם ידנית ל-confirmed לפני
 * שהתשלום בפועל התקבל (מותר במכונת המצבים — pending→confirmed הוא
 * מעבר חוקי בציר ה-state לבדו) הייתה נעלמת מ"ממתינות לתשלום" למרות
 * שהיא עדיין לא שולמה. ההגדרה הנכונה: payment_state עדיין לא שולם,
 * וההזמנה לא סגורה/מבוטלת — בדיוק התנאי שכבר קובע מתי מוצגות פעולות
 * הגבייה בעמוד ההזמנה עצמו (OrderActionsPanel).
 */
export const SAVED_VIEWS: Record<string, { label: string; filter: OrdersFilter }> = {
  pending_payment: { label: 'ממתינות לתשלום', filter: { view: 'pending_payment' } },
  new: { label: 'חדשות לטיפול', filter: { view: 'new', state: 'confirmed' } },
  preparing: { label: 'בהכנה', filter: { view: 'preparing', fulfillment: 'preparing' } },
  ready_pickup: { label: 'ממתינות לאיסוף', filter: { view: 'ready_pickup', fulfillment: 'ready_for_pickup' } },
  shipped: { label: 'נשלחו', filter: { view: 'shipped', fulfillment: 'shipped' } },
  doc_missing: { label: 'תשלום ללא מסמך', filter: { view: 'doc_missing' } },
  cancel_requests: { label: 'בקשות ביטול', filter: { view: 'cancel_requests' } },
  attention: { label: 'דורשות טיפול', filter: { view: 'attention' } },
};

/** [1.4] בונה קישור מלא לתצוגה שמורה — מקור יחיד, נצרך גם ברשימה וגם בדשבורד. */
export function savedViewHref(key: keyof typeof SAVED_VIEWS): string {
  const view = SAVED_VIEWS[key];
  if (!view) return '/admin/orders';
  const params = new URLSearchParams();
  if (view.filter.q) params.set('q', view.filter.q);
  if (view.filter.state) params.set('state', view.filter.state);
  if (view.filter.payment) params.set('payment', view.filter.payment);
  if (view.filter.fulfillment) params.set('fulfillment', view.filter.fulfillment);
  if (view.filter.view) params.set('view', view.filter.view);
  const qs = params.toString();
  return qs ? `/admin/orders?${qs}` : '/admin/orders';
}

/**
 * [1.4] שני תיקונים על הגרסה הקודמת:
 *  - עימוד אמיתי (range + count) במקום limit(100) קשיח בלי שום סימון
 *    שהרשימה נחתכה — חנות פעילה הייתה מאבדת הזמנות מהמסך בלי שאיש ידע.
 *  - כשל DB מדווח כ-error:true ולא כ-[] — לפני כן כשל מסד ורשימה ריקה
 *    מסינון נראו בדיוק אותו דבר ("אין הזמנות התואמות לסינון").
 */
export async function listOrders(filter: OrdersFilter): Promise<OrdersListResult> {
  const page = Math.max(1, Math.floor(Number(filter.page) || 1));
  const pageSize = ORDERS_PAGE_SIZE;
  const empty = (error: boolean): OrdersListResult => ({ orders: [], total: error ? null : 0, page, pageSize, error });

  const supabase = await createClient();
  if (!supabase) return empty(true);

  let query = supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (filter.state) query = query.eq('state', filter.state);
  if (filter.payment) query = query.eq('payment_state', filter.payment);
  if (filter.fulfillment) query = query.eq('fulfillment_state', filter.fulfillment);
  if (filter.view === 'pending_payment') {
    query = query.in('payment_state', ['pending', 'failed']).not('state', 'in', '(cancelled,closed)');
  }
  if (filter.view === 'doc_missing') {
    query = query.eq('payment_state', 'paid').in('document_state', ['not_created', 'pending', 'failed']);
  }
  if (filter.view === 'cancel_requests') {
    query = query.overlaps('tags', ['cancel-requested']);
  }
  if (filter.view === 'attention') {
    query = query.or(
      'tags.ov.{amount-mismatch,attention,reconcile-mismatch},state.eq.cancel_pending_refund',
    );
  }
  if (filter.q) {
    const q = filter.q.trim();
    const asNumber = Number(q);
    if (Number.isInteger(asNumber) && asNumber > 0) {
      query = query.eq('order_number', asNumber);
    } else {
      // [1.4] q הגולמי היה משורשר ישירות לתוך מחרוזת ה-.or() של PostgREST:
      // פסיק/סוגריים בקלט פירקו את הביטוי לתנאי סינון נוספים. ה-RLS עדיין
      // מגן על השורות, אבל זה קלט לא-מסונן שנכנס לשפת שאילתה. פסיקים
      // וסוגריים מוסרים (אין להם משמעות בחיפוש חופשי), ותווי הכללה של
      // ILIKE (%،_) נבלמים כדי שלא ישנו את דפוס ההתאמה.
      const safe = q.replace(/[,()]/g, ' ').replace(/[%_\\]/g, (c) => `\\${c}`).trim();
      const pattern = `%${safe}%`;
      query = query.or(
        `contact_name.ilike.${pattern},contact_email.ilike.${pattern},contact_phone.ilike.${pattern}`,
      );
    }
  }

  const { data, error, count } = await query;
  if (error) {
    console.error('[admin:orders] list', error.message);
    return empty(true);
  }
  return { orders: (data ?? []) as Order[], total: count ?? null, page, pageSize, error: false };
}

export interface OrderDetail {
  order: Order;
  items: OrderItem[];
  events: OrderEvent[];
  payments: Payment[];
  documents: CommerceDocument[];
  notifications: NotificationLogEntry[];
  serviceRequests: ServiceRequestRow[];
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (error || !order) return null;

  const [items, events, payments, documents, notifications, serviceRequests] = await Promise.all([
    supabase.from('order_items').select('*').eq('order_id', orderId).order('created_at'),
    supabase.from('order_events').select('*').eq('order_id', orderId).order('created_at'),
    supabase.from('payments').select('*').eq('order_id', orderId).order('created_at'),
    supabase.from('documents').select('*').eq('order_id', orderId).order('created_at'),
    supabase.from('notification_log').select('*').eq('order_id', orderId).order('created_at'),
    supabase.from('service_requests').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
  ]);

  return {
    order: order as Order,
    items: (items.data ?? []) as OrderItem[],
    events: (events.data ?? []) as OrderEvent[],
    payments: (payments.data ?? []) as Payment[],
    documents: (documents.data ?? []) as CommerceDocument[],
    notifications: (notifications.data ?? []) as NotificationLogEntry[],
    serviceRequests: (serviceRequests.data ?? []) as ServiceRequestRow[],
  };
}

export interface InventoryLocationLevel {
  locationId: string;
  locationName: string;
  onHand: number;
  reserved: number;
}

export interface InventoryRow {
  bookId: string;
  title: string;
  sku: string | null;
  stockLocation: string | null;
  isPurchasable: boolean;
  isStockManaged: boolean;
  onHand: number;
  reserved: number;
  available: number;
  lowThreshold: number | null;
  /** [1.1] פירוט פר מיקום — ריבוי מחסנים (הכרעה 9) */
  perLocation: InventoryLocationLevel[];
}

export interface StockLocationRow {
  id: string;
  slug: string;
  name: string;
  kind: string;
  isDefault: boolean;
  active: boolean;
}

export async function listStockLocations(): Promise<StockLocationRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('stock_locations')
    .select('id, slug, name, kind, is_default, active')
    .order('sort_order');
  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    kind: row.kind,
    isDefault: row.is_default,
    active: row.active,
  }));
}

export async function listInventory(): Promise<InventoryRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const [{ data: books }, { data: levels }, locations] = await Promise.all([
    supabase
      .from('books')
      .select('id, title_he, sku, stock_location, is_purchasable, is_stock_managed, low_stock_threshold, stock_quantity')
      .order('title_he'),
    supabase.from('inventory_levels').select('*'),
    listStockLocations(),
  ]);

  const locationName = new Map(locations.map((loc) => [loc.id, loc.name]));
  // [1.1] ספר יכול להחזיק level בכל מחסן — צוברים, לא דורסים
  const levelsByBook = new Map<string, InventoryLevel[]>();
  for (const level of (levels ?? []) as InventoryLevel[]) {
    const list = levelsByBook.get(level.book_id) ?? [];
    list.push(level);
    levelsByBook.set(level.book_id, list);
  }

  return (books ?? []).map((book) => {
    const bookLevels = levelsByBook.get(book.id) ?? [];
    const onHand = bookLevels.length
      ? bookLevels.reduce((sum, level) => sum + level.on_hand, 0)
      : (book.stock_quantity ?? 0);
    const reserved = bookLevels.reduce((sum, level) => sum + level.reserved, 0);
    return {
      bookId: book.id,
      title: book.title_he,
      sku: book.sku,
      stockLocation: book.stock_location,
      isPurchasable: book.is_purchasable,
      isStockManaged: book.is_stock_managed ?? true,
      onHand,
      reserved,
      available: onHand - reserved,
      lowThreshold: book.low_stock_threshold,
      perLocation: bookLevels
        .map((level) => ({
          locationId: level.location_id,
          locationName: locationName.get(level.location_id) ?? '—',
          onHand: level.on_hand,
          reserved: level.reserved,
        }))
        .sort((a, b) => a.locationName.localeCompare(b.locationName, 'he')),
    };
  });
}
