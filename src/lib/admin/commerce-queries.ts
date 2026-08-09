import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type {
  CommerceDocument,
  ConsentEvent,
  Customer,
  CustomerAddress,
  InventoryLevel,
  InventoryMoveType,
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

export interface CustomerOrderRow {
  id: string;
  orderNumber: number;
  total: number;
  donationAmount: number;
  paymentState: string;
  state: string;
  fulfillmentState: string;
  createdAt: string;
}

export interface CustomerDetail {
  key: string;
  customer: Customer | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  orders: CustomerOrderRow[];
  addresses: CustomerAddress[];
  consents: ConsentEvent[];
  error: boolean;
}

const CUSTOMER_ORDER_SELECT =
  'id, order_number, contact_name, contact_phone, contact_email, total, donation_amount, payment_state, state, fulfillment_state, created_at';

function emptyCustomerDetail(key: string, error = false): CustomerDetail {
  return {
    key,
    customer: null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    orders: [],
    addresses: [],
    consents: [],
    error,
  };
}

/**
 * [1.6] עמוד לקוח (ביקורת ג.25/ט.3) — "מפתח" הזהות הוא טלפון/מייל, כמו
 * ברשימת הלקוחות (contact_phone ?? contact_email), לא customers.id: רוב
 * הלקוחות הם אורחים בלי רשומת customers כלל. שתי שאילתות .eq() נפרדות
 * (טלפון ומייל) וממוזגות בזיכרון — לא .or() עם קלט מה-URL, כדי לא לבנות
 * ביטוי סינון PostgREST מפסיק/סוגר גולמי ולא-מטוהר (אותו עיקרון כמו
 * חיפוש ההזמנות החופשי ב-listOrders).
 *
 * ההסכמות (consent_events) הן פער רגולטורי מתועד: נשלפות גם לפי טלפון/
 * מייל (קיימות גם ללקוח-אורח בלי customer_id) וגם לפי customer_id
 * (ללקוח רשום) — וממוזגות, כי אירוע יכול היה להירשם באיזו מהדרכים.
 */
export async function getCustomerDetail(key: string): Promise<CustomerDetail> {
  if (!key) return emptyCustomerDetail(key, true);
  const supabase = await createClient();
  if (!supabase) return emptyCustomerDetail(key, true);

  const [byPhone, byEmail] = await Promise.all([
    supabase.from('orders').select(CUSTOMER_ORDER_SELECT).eq('contact_phone', key).order('created_at', { ascending: false }).limit(300),
    supabase.from('orders').select(CUSTOMER_ORDER_SELECT).eq('contact_email', key).order('created_at', { ascending: false }).limit(300),
  ]);
  if (byPhone.error || byEmail.error) {
    console.error('[admin:customer] orders', byPhone.error?.message ?? byEmail.error?.message);
    return emptyCustomerDetail(key, true);
  }

  const orderMap = new Map<string, NonNullable<typeof byPhone.data>[number]>();
  for (const row of [...(byPhone.data ?? []), ...(byEmail.data ?? [])]) orderMap.set(row.id, row);
  const orderRows = [...orderMap.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));

  const contactPhone = orderRows.find((o) => o.contact_phone)?.contact_phone ?? (key.includes('@') ? null : key);
  const contactEmail = orderRows.find((o) => o.contact_email)?.contact_email ?? (key.includes('@') ? key : null);
  const contactName = orderRows.find((o) => o.contact_name)?.contact_name ?? null;

  const [customerRes, consentsByPhoneRes, consentsByEmailRes] = await Promise.all([
    contactPhone ? supabase.from('customers').select('*').eq('phone', contactPhone).maybeSingle() : Promise.resolve({ data: null }),
    contactPhone
      ? supabase.from('consent_events').select('*').eq('phone', contactPhone).order('created_at', { ascending: false }).limit(100)
      : Promise.resolve({ data: [] }),
    contactEmail
      ? supabase.from('consent_events').select('*').eq('email', contactEmail).order('created_at', { ascending: false }).limit(100)
      : Promise.resolve({ data: [] }),
  ]);

  const customer = (customerRes.data as Customer | null) ?? null;

  const [consentsByCustomerIdRes, addressesRes] = await Promise.all([
    customer
      ? supabase.from('consent_events').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(100)
      : Promise.resolve({ data: [] }),
    customer
      ? supabase.from('customer_addresses').select('*').eq('customer_id', customer.id).order('is_default', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const consentMap = new Map<string, ConsentEvent>();
  for (const row of [
    ...((consentsByPhoneRes.data ?? []) as ConsentEvent[]),
    ...((consentsByEmailRes.data ?? []) as ConsentEvent[]),
    ...((consentsByCustomerIdRes.data ?? []) as ConsentEvent[]),
  ]) {
    consentMap.set(row.id, row);
  }
  const consents = [...consentMap.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return {
    key,
    customer,
    contactName,
    contactPhone,
    contactEmail,
    orders: orderRows.map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      total: Number(o.total),
      donationAmount: Number(o.donation_amount ?? 0),
      paymentState: o.payment_state,
      state: o.state,
      fulfillmentState: o.fulfillment_state,
      createdAt: o.created_at,
    })),
    addresses: (addressesRes.data ?? []) as CustomerAddress[],
    consents,
    error: false,
  };
}

export const INVENTORY_MOVE_TYPE_LABELS: Record<InventoryMoveType, string> = {
  receive: 'קליטת מלאי',
  sale: 'מכירה',
  cancel_restock: 'שחרור מביטול (לא נשלח)',
  return_restock: 'החזרה פיזית למלאי',
  damage: 'נזק',
  manual_adjust: 'תיקון ידני',
  transfer_in: 'הועבר פנימה (בין מחסנים)',
  transfer_out: 'הועבר החוצה (בין מחסנים)',
  count: 'ספירת מלאי',
  reserve: 'שריון להזמנה',
  release: 'שחרור שריון',
};

export interface InventoryMoveRow {
  id: string;
  bookId: string;
  bookTitle: string;
  locationName: string;
  moveType: InventoryMoveType;
  quantityDelta: number;
  onHandBefore: number;
  onHandAfter: number;
  reason: string | null;
  orderId: string | null;
  actorType: string;
  actorName: string | null;
  note: string | null;
  createdAt: string;
}

export interface InventoryMovesFilter {
  bookId?: string;
  moveType?: string;
  page?: string;
}

const INVENTORY_MOVES_PAGE_SIZE = 50;

export interface InventoryMovesResult {
  rows: InventoryMoveRow[];
  total: number | null;
  page: number;
  pageSize: number;
  error: boolean;
}

/**
 * [1.6] היסטוריית תנועות מלאי (ביקורת ג.12/ט.6) — inventory_moves הוא
 * ledger מלא (append-only, on_hand_before/after על כל שורה) בלי צרכן
 * UI כלשהו. מסך קריאה-בלבד; מזהי ספר/מיקום/יוצר נפתרים בשאילתה שנייה
 * (אותו דפוס כמו getAttentionReport/getBookEngagementReport) ולא embed.
 */
export async function listInventoryMoves(filter: InventoryMovesFilter): Promise<InventoryMovesResult> {
  const page = Math.max(1, Math.floor(Number(filter.page) || 1));
  const pageSize = INVENTORY_MOVES_PAGE_SIZE;
  const empty = (error: boolean): InventoryMovesResult => ({ rows: [], total: error ? null : 0, page, pageSize, error });

  const supabase = await createClient();
  if (!supabase) return empty(true);

  let query = supabase
    .from('inventory_moves')
    .select(
      'id, book_id, location_id, move_type, quantity_delta, on_hand_before, on_hand_after, reason, order_id, actor_type, actor_id, note, created_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (filter.bookId) query = query.eq('book_id', filter.bookId);
  if (filter.moveType) query = query.eq('move_type', filter.moveType);

  const { data, error, count } = await query;
  if (error) {
    console.error('[admin:inventory-moves] list', error.message);
    return empty(true);
  }

  const rows = data ?? [];
  const bookIds = [...new Set(rows.map((r) => r.book_id))];
  const locationIds = [...new Set(rows.map((r) => r.location_id))];
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((id): id is string => Boolean(id)))];

  const [booksRes, locationsRes, profilesRes] = await Promise.all([
    bookIds.length > 0 ? supabase.from('books').select('id, title_he').in('id', bookIds) : Promise.resolve({ data: [] }),
    locationIds.length > 0 ? supabase.from('stock_locations').select('id, name').in('id', locationIds) : Promise.resolve({ data: [] }),
    actorIds.length > 0 ? supabase.from('profiles').select('id, full_name').in('id', actorIds) : Promise.resolve({ data: [] }),
  ]);

  const titleByBookId = new Map((booksRes.data ?? []).map((b) => [b.id, b.title_he]));
  const nameByLocationId = new Map((locationsRes.data ?? []).map((l) => [l.id, l.name]));
  const nameByActorId = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name ?? '—']));

  return {
    rows: rows.map((row) => ({
      id: row.id,
      bookId: row.book_id,
      bookTitle: titleByBookId.get(row.book_id) ?? 'ספר שנמחק',
      locationName: nameByLocationId.get(row.location_id) ?? '—',
      moveType: row.move_type as InventoryMoveType,
      quantityDelta: row.quantity_delta,
      onHandBefore: row.on_hand_before,
      onHandAfter: row.on_hand_after,
      reason: row.reason,
      orderId: row.order_id,
      actorType: row.actor_type,
      actorName: row.actor_id ? (nameByActorId.get(row.actor_id) ?? null) : null,
      note: row.note,
      createdAt: row.created_at,
    })),
    total: count ?? null,
    page,
    pageSize,
    error: false,
  };
}
