/**
 * טיפוסי מסד הנתונים — משקפים את supabase/schema.sql.
 * בשינוי סכימה יש לעדכן כאן (או לייצר מחדש עם `supabase gen types typescript`).
 */

/**
 * חמשת התפקידים של מודל 1.1 (פרק 19 במסמך האב) + viewer היסטורי:
 * admin — מנהל-על; manager — הכל מלבד ניהול משתמשים; editor — עורך תוכן
 * (ללא חנות); seller — מוכרן (חנות ללא תוכן); picker — מלקט (תפעול
 * הזמנות בלבד, ללא סכומים); viewer — צפייה בתוכן בלבד.
 */
export type UserRole = 'admin' | 'manager' | 'editor' | 'seller' | 'picker' | 'viewer';

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'shipped' | 'cancelled' | 'refunded';

export interface Category {
  id: string;
  slug: string;
  name_he: string;
  name_en: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Author {
  id: string;
  catalogue_number: number;
  slug: string;
  name_he: string;
  name_en: string | null;
  bio_he: string | null;
  bio_en: string | null;
  portrait_url: string | null;
  birth_year: string | null;
  death_year: string | null;
  /** ציר תולדות חיים — שנה ומשפט קצר, לתצוגה כציר זמן אופקי בעמוד הספר. */
  timeline: { year: string; text: string }[];
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Book {
  id: string;
  /** מספור רץ להצגה — לא ה-uuid. יציב, לא ניתן לעריכה ולא ממוחזר אחרי מחיקה. */
  catalogue_number: number;
  slug: string;
  title_he: string;
  title_en: string | null;
  subtitle_he: string | null;
  subtitle_en: string | null;
  description_he: string | null;
  description_en: string | null;
  /** תמצית קצרה ("30 שניות") — לצד התיאור המלא בעמוד הספר, לא במקומו. */
  description_brief_he: string | null;
  description_brief_en: string | null;
  author_id: string | null;
  /** מחבר כטקסט חופשי — כשמלא, גובר על שם המחבר המשויך בכל תצוגה, בלי קישור לעמוד מחבר. */
  author_name_he: string | null;
  author_name_en: string | null;
  category_id: string | null;
  publication_year_he: string | null;
  publication_year_ce: number | null;
  cover_image_url: string | null;
  /** צילום שדרת הספר למדף בעמוד הבית. ריק = נגזרת מהכריכה (ראו BookSpine.tsx). */
  spine_image_url: string | null;
  pages: number | null;
  format: string | null;
  binding: string | null;
  isbn: string | null;
  volume_count: number | null;
  sample_pdf_url: string | null;
  /* --- שדות מסחר: קיימים בסכימה, רדומים עד הפעלת החנות --- */
  price: number | null;
  currency: string | null;
  sku: string | null;
  stock_quantity: number | null;
  is_purchasable: boolean;
  weight_grams: number | null;
  /** מיקום המלאי הפיזי (למשל "מדף A3") — לצוות בלבד, לא מוצג באתר. */
  stock_location: string | null;
  /** גודל פיזי (למשל "17x24 ס״מ"). */
  physical_size: string | null;
  /* --- הרחבות מסחר (26_books_commerce_extension.sql) --- */
  sale_price: number | null;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
  sale_name_he: string | null;
  sale_name_en: string | null;
  compare_at_price: number | null;
  tax_group: 'standard' | 'exempt';
  /** false = מלאי בלתי מוגבל — אין שמירה ואין הפחתה. */
  is_stock_managed: boolean;
  low_stock_threshold: number | null;
  allow_backorder: boolean;
  barcode: string | null;
  /** דריסת זמן ההכנה (ימי עסקים) לספר הזה — מזין את חישוב תאריך האספקה. */
  prep_days_override: number | null;
  free_shipping_eligible: boolean;
  coupons_excluded: boolean;
  /* ------------------------------------------------------- */
  is_published: boolean;
  sort_order: number;
  /* --- שכבת המידע: שפות, טקסט חלופי ו-SEO --- */
  languages: string[];
  cover_alt: string | null;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  canonical_url: string | null;
  search_keywords: string | null;
  /* ------------------------------------------ */
  /* --- שלב ג׳: עמוד תצוגת הספר --- */
  series_id: string | null;
  /** כרך א׳ = 1. null = בסדרה בלי סדר מוגדר. */
  series_position: number | null;
  quotes: string[];
  /** ספירה גסה, לא ייחודית למבקר — ראו 10_book_page_stage_c.sql */
  view_count: number;
  /* -------------------------------- */
  /* --- שלב ד׳: מרחב הגילוי (14_book_page_v3.sql) --- */
  publisher_he: string | null;
  publisher_en: string | null;
  edition_he: string | null;
  edition_en: string | null;
  /** גוון "#rrggbb", override ידני לרקע ה-Hero. null = חילוץ אוטומטי מהכריכה. */
  accent_primary: string | null;
  accent_secondary: string | null;
  is_featured: boolean;
  preorder_enabled: boolean;
  preorder_release_date: string | null;
  /* ------------------------------------------------ */
  /** הדמיית כריכה שקופה ל-Hero (שדרה/עובי/תאורה מוכנים) — 15_book_flip_preview.sql. */
  hero_mockup_url: string | null;
  created_at: string;
  updated_at: string;
}

/** דף דוגמה שעבר המרה חד-פעמית ל-WebP — ראו book_preview_pages. */
export interface BookPreviewPage {
  id: string;
  book_id: string;
  page_number: number;
  image_url: string;
  width: number;
  height: number;
  created_at: string;
}

/** מצב הזמינות הציבורי — לעולם לא כמות מספרית. */
export type BookAvailability = 'catalog_only' | 'in_stock' | 'out_of_stock' | 'preorder';

/** צורת ספר קלה, לכרטיס בקבוצת גילוי (קשרים, סדרה) — לא BookWithRelations המלא. */
export interface RelatedBookCard {
  id: string;
  slug: string;
  title_he: string;
  title_en: string | null;
  cover_image_url: string | null;
  price: number | null;
  currency: string | null;
  is_purchasable: boolean;
  stock_quantity: number | null;
  author: Pick<Author, 'id' | 'slug' | 'name_he' | 'name_en'> | null;
}

export type BookRelationType =
  | 'complements'
  | 'recommended'
  | 'previous_edition'
  | 'next_edition'
  | 'staff_pick'
  | 'bundle';

/** קשר ידני שנקבע בניהול — ראו book_relations, 14_book_page_v3.sql. */
export interface BookRelation {
  id: string;
  relation_type: BookRelationType;
  sort_order: number;
  note_he: string | null;
  note_en: string | null;
  target: RelatedBookCard;
}

/** תגית נושא. עצמאית מקטגוריה: קטגוריה היא מדף, תגית היא נושא. */
export interface Tag {
  id: string;
  slug: string;
  name_he: string;
  name_en: string | null;
  is_system: boolean;
  /** "למה קיבל את התג" — מוצג ב-Tooltip בעמוד הספר. */
  description_he: string | null;
}

/** תחום פנייה (support/ספרים/הזמנות...) — בורר רשות בטופס יצירת הקשר. */
export interface ContactTopic {
  id: string;
  name_he: string;
  name_en: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
}

/** שדה מותאם אישית שהצוות מוסיף לטופס יצירת הקשר, בלי לגעת בקוד. */
export interface ContactField {
  id: string;
  label_he: string;
  label_en: string | null;
  field_type: 'text' | 'textarea' | 'select' | 'checkbox';
  /** אפשרויות ל-select בלבד — שורה אחת לכל אפשרות. */
  options_he: string | null;
  options_en: string | null;
  is_required: boolean;
  sort_order: number;
  is_published: boolean;
  created_at: string;
}

/** סדרת ספרים — כרכים של אותה מהדורה, לא שדה טקסט חופשי על הספר. */
export interface Series {
  id: string;
  slug: string;
  name_he: string;
  name_en: string | null;
  description_he: string | null;
  created_at: string;
  updated_at: string;
}

/** תמונה נוספת של ספר, מעבר לכריכה הראשית (books.cover_image_url). */
export interface BookImage {
  id: string;
  book_id: string;
  image_url: string;
  alt: string | null;
  caption_he: string | null;
  sort_order: number;
}

/** שורת תוכן עניינים. level 0 = פרק ראשי, 1 = תת-פרק. */
export interface BookTocEntry {
  id: string;
  book_id: string;
  title_he: string;
  level: number;
  page_number: number | null;
  summary_he: string | null;
  sort_order: number;
}

/** סוג מאפיין — כריכה, פורמט, קהל יעד. */
export interface Attribute {
  id: string;
  slug: string;
  name_he: string;
  name_en: string | null;
  /** האם ניתן לבחור יותר מערך אחד */
  is_multi: boolean;
  sort_order: number;
}

export interface AttributeValue {
  id: string;
  attribute_id: string;
  slug: string;
  name_he: string;
  name_en: string | null;
  sort_order: number;
}

export interface AttributeWithValues extends Attribute {
  values: AttributeValue[];
}

/** הקשרים של ספר, כפי שהם נשלפים לטופס העריכה. */
export interface BookRelations {
  tagIds: string[];
  categoryIds: string[];
  attributeValueIds: string[];
}

/** ספר עם היחסים שנשלפו יחד (join) — הצורה שבה הקטלוג צורך אותו. */
export interface BookWithRelations extends Book {
  author: Pick<Author, 'id' | 'slug' | 'name_he' | 'name_en'> | null;
  category: Pick<Category, 'id' | 'slug' | 'name_he' | 'name_en'> | null;
  /** מזהי תגיות ומאפיינים, כשהשליפה ביקשה אותם */
  tags?: Pick<Tag, 'id' | 'slug' | 'name_he' | 'name_en' | 'description_he'>[];
  attributeValues?: Pick<AttributeValue, 'id' | 'slug' | 'name_he' | 'attribute_id'>[];
  /** שלושת השדות הבאים נשלפים רק בעמוד הספר הבודד, לא ברשימות וכרטיסים */
  series?: Pick<Series, 'id' | 'slug' | 'name_he' | 'name_en'> | null;
  images?: BookImage[];
  toc?: BookTocEntry[];
  /** קשרים ידניים שהצוות קבע — נשלפים רק בעמוד הספר הבודד. */
  relations?: BookRelation[];
  /** דפי דוגמה שעברו המרה — נשלפים רק בעמוד הספר הבודד, ממוינים לפי page_number. */
  previewPages?: BookPreviewPage[];
}

export interface Activity {
  id: string;
  slug: string;
  title_he: string;
  title_en: string | null;
  summary_he: string | null;
  summary_en: string | null;
  body_he: string | null;
  body_en: string | null;
  icon: string | null;
  cover_image_url: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface GalleryImage {
  url: string;
  caption_he?: string;
  caption_en?: string;
}

/** קובץ שצורף לפניית יצירת קשר — נשמר כ-path (לא URL) כי ה-bucket פרטי. */
export interface ContactAttachment {
  path: string;
  name: string;
  size: number;
  type: string;
}

export interface EventRecord {
  id: string;
  slug: string;
  title_he: string;
  title_en: string | null;
  event_date: string | null;
  event_date_he: string | null;
  body_he: string | null;
  body_en: string | null;
  cover_image_url: string | null;
  featured_video_url: string | null;
  /** הגלריה המסיימת — תמונות שלא שובצו ידנית לתוך blocks (ראו event_blocks). */
  gallery: GalleryImage[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
  /** נשלף רק בעמוד האירוע הבודד, לא ברשימות. */
  blocks?: EventBlock[];
}

export type EventBlockType = 'text' | 'image' | 'image_row' | 'video' | 'quote';

export interface EventBlockImage {
  url: string;
  alt: string | null;
  caption_he: string | null;
}

/**
 * בלוק בסיפור האירוע. השדות הרלוונטיים תלויים ב-type; שאר השדות null
 * או מערך ריק. "רחב" במכוון (עמודות לכל סוג) ולא jsonb פולימורפי — כדי
 * שעורך הבלוקים בניהול יוכל להיבנות משדות טיפוסיים רגילים.
 */
export interface EventBlock {
  id: string;
  event_id: string;
  type: EventBlockType;
  sort_order: number;
  /** תג תחנה אופציונלי למד ההתקדמות, למשל "קבלת פנים". */
  stage_label: string | null;
  body_he: string | null;
  body_en: string | null;
  image_url: string | null;
  image_alt: string | null;
  image_caption_he: string | null;
  images: EventBlockImage[];
  video_url: string | null;
  video_caption_he: string | null;
  quote_text: string | null;
  quote_attribution_he: string | null;
}

export interface ContentPage {
  id: string;
  slug: string;
  title_he: string;
  title_en: string | null;
  body_he: string | null;
  body_en: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface SiteContact {
  address_he?: string;
  address_en?: string;
  email?: string;
  phone?: string;
  /** מספר עמותה — נדרש בתקנון ובמדיניות הפרטיות */
  registration_number?: string;
  /** ממונה פרטיות ורכז נגישות — נדרשים בעמודי החובה */
  privacy_officer?: string;
  accessibility_officer?: string;
}

export interface SiteSettings {
  id: number;
  logo_url: string | null;
  /** גרסה הפוכה/בהירה ללוגו, לרקעים כהים (תחתית, רצועות on-dark). null = נגזר מהלוגו הרגיל. */
  logo_dark_url: string | null;
  contact: SiteContact;
  social_links: Record<string, string>;
  store_enabled: boolean;
  extra: Record<string, unknown>;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export type BannerFocalPoint = 'center' | 'top' | 'bottom' | 'start' | 'end';

export interface Banner {
  id: string;
  title_he: string;
  title_en: string | null;
  subtitle_he: string | null;
  subtitle_en: string | null;
  image_url: string | null;
  image_mobile_url: string | null;
  focal_point: BannerFocalPoint;
  link_url: string | null;
  cta_label_he: string | null;
  cta_label_en: string | null;
  is_published: boolean;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

/* ============================================================================
 * טיפוסי המסחר — משקפים את supabase/23–35_*.sql
 * ========================================================================= */

/**
 * ציר חיי ההזמנה. הישן (OrderStatus) נשאר לתאימות עד migration הניקיון.
 * cancel_pending_refund [1.1]: אושר ביטול על הזמנה ששולמה — ההזמנה אינה
 * cancelled עד שהזיכוי המלא מצליח במורנינג (תרשים 13).
 */
export type OrderState =
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'cancel_pending_refund'
  | 'completed'
  | 'cancelled'
  | 'closed';

export type PaymentState =
  | 'not_required'
  | 'pending'
  | 'authorized'
  | 'paid'
  | 'failed'
  | 'partially_refunded'
  | 'refunded'
  | 'cancelled';

export type FulfillmentState =
  | 'unfulfilled'
  | 'preparing'
  | 'ready_for_pickup'
  | 'partially_fulfilled'
  | 'fulfilled'
  | 'shipped'
  | 'delivered'
  | 'returned';

export type DocumentState =
  | 'not_created'
  | 'pending'
  | 'created'
  | 'failed'
  | 'cancelled'
  | 'credited';

export type OrderChannel = 'web' | 'phone' | 'manual';
export type FulfillmentType = 'shipping' | 'pickup';
export type PaymentMethod = 'credit' | 'bit' | 'apple_pay' | 'google_pay' | 'manual_external';
export type ActorType = 'customer' | 'staff' | 'system' | 'morning' | 'shipping_provider';
export type ShelfKey = 'wantToRead' | 'wantToBuy' | 'owned' | 'wantAsGift';

/** מבנה כתובת המשלוח כפי שנשמר ב-orders.shipping_address (צילום). */
export interface ShippingAddress {
  recipient_name: string;
  phone: string;
  city: string;
  street: string;
  house_number: string;
  entrance?: string;
  floor?: string;
  apartment?: string;
  zip?: string;
}

export interface Order {
  id: string;
  order_number: number;
  user_id: string | null;
  /** השדה הישן — מוזן אוטומטית מהצירים בטריגר; אין לכתוב אליו ישירות. */
  status: OrderStatus;
  state: OrderState;
  payment_state: PaymentState;
  fulfillment_state: FulfillmentState;
  document_state: DocumentState;
  channel: OrderChannel;
  locale: string;
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  donation_amount: number;
  tax_total: number;
  total: number;
  currency: string;
  coupon_id: string | null;
  coupon_code_snapshot: string | null;
  fulfillment_type: FulfillmentType;
  shipping_method_id: string | null;
  shipping_method_name_snapshot: string | null;
  promised_delivery_date: string | null;
  shipping_address: ShippingAddress | null;
  courier_notes: string | null;
  is_gift: boolean;
  gift_recipient_name: string | null;
  gift_message: string | null;
  gift_hide_prices: boolean;
  guest_token_hash: string | null;
  guest_token_expires_at: string | null;
  guest_token_revoked: boolean;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  payment_ref: string | null;
  placed_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
  tags: string[];
  idempotency_key: string | null;
  /** [1.1] עלות המשלוח בפועל — מול shipping_total שנגבה (דוח הפער). */
  actual_shipping_cost: number | null;
  /** [1.3] הערת מלקט — למה לא לוקט הכל, וכד' */
  packing_note: string | null;
  /** [1.3] שורת הנחת צוות מנומקת (עריכת חשבון עד האריזה) */
  staff_discount: number;
  staff_discount_reason: string | null;
  /** [1.3] המבצע האוטומטי שהוחל (צילום) */
  promotion_id: string | null;
  promotion_name_snapshot: string | null;
  /** [1.4] מספר מעקב — על ההזמנה עצמה, לא רק בציר הזמן */
  tracking_company: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  book_id: string | null;
  title_snapshot: string | null;
  sku_snapshot: string | null;
  quantity: number;
  unit_price: number;
  unit_price_original: number | null;
  discount_amount: number;
  tax_rate_snapshot: number | null;
  line_total: number | null;
  is_preorder: boolean;
  /** [1.1] צילום עלות ליחידה בעת ההזמנה — לצוות בהרשאת עלויות בלבד. */
  cost_price_snapshot: number | null;
  /** [1.3] כמה לוקטו בפועל; null = טרם התחיל ליקוט */
  picked_quantity: number | null;
}

/** [1.3] מבצע אוטומטי — הנחה כלל-אתרית/קטגוריה/ספרים, בלי קוד. */
export interface Promotion {
  id: string;
  name: string;
  kind: 'percent' | 'fixed';
  value: number;
  scope: {
    all?: boolean;
    category_ids?: string[];
    book_ids?: string[];
    exclude_book_ids?: string[];
  };
  min_total: number | null;
  min_quantity: number | null;
  combinable_with_coupon: boolean;
  starts_at: string | null;
  ends_at: string | null;
  priority: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/** [1.1] עלות פנימית לספר — טבלה פרטית (book_costs), admin/manager בלבד. */
export interface BookCost {
  book_id: string;
  cost_price: number;
  currency: string;
  note: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  event_type: string;
  data: Record<string, unknown>;
  actor_type: ActorType;
  actor_id: string | null;
  actor_label: string | null;
  created_at: string;
}

/** [1.4] תוצאת ריצת התאמה יומית מול מורנינג — reconciliation_runs */
export interface ReconciliationRun {
  id: string;
  ran_at: string;
  checked: number;
  matched: number;
  mismatched: number;
  unreachable: number;
  skipped: string | null;
}

export interface Payment {
  id: string;
  order_id: string;
  kind: 'charge' | 'refund';
  parent_payment_id: string | null;
  provider: string;
  method: PaymentMethod | null;
  amount: number;
  currency: string;
  installments: number;
  status: 'initiated' | 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
  morning_transaction_id: string | null;
  morning_payment_page_url: string | null;
  morning_payload: Record<string, unknown> | null;
  idempotency_key: string;
  error: Record<string, unknown> | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DocumentType = 'invoice_receipt' | 'receipt' | 'donation_receipt' | 'credit_note';

export interface CommerceDocument {
  id: string;
  order_id: string;
  payment_id: string | null;
  provider: string;
  morning_doc_id: string | null;
  doc_type: DocumentType;
  doc_number: string | null;
  issued_at: string | null;
  amount: number;
  currency: string;
  status: 'pending' | 'created' | 'failed' | 'cancelled';
  download_url: string | null;
  url_expires_at: string | null;
  storage_path: string | null;
  error: string | null;
  attempts: number;
  last_attempt_at: string | null;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookEvent {
  id: string;
  provider: string;
  event_type: string | null;
  external_event_id: string | null;
  dedupe_hash: string;
  signature_valid: boolean;
  payload: Record<string, unknown>;
  received_at: string;
  processing_status: 'received' | 'processed' | 'duplicate' | 'invalid_signature' | 'failed';
  processed_at: string | null;
  attempts: number;
  error: string | null;
  order_id: string | null;
  payment_id: string | null;
  /** [1.1] השדות העסקיים שחולצו — שורדים את טיהור הגולמי (90 יום). */
  payload_normalized: Record<string, unknown> | null;
  /** [1.1] הגוף חצה את תקרת הגודל ולא נשמר גולמי. */
  payload_truncated: boolean;
  /** [1.1] מתי job התחזוקה רוקן את ה-payload הגולמי. */
  raw_purged_at: string | null;
}

export interface Customer {
  id: string;
  phone: string;
  email: string | null;
  full_name: string | null;
  default_address_id: string | null;
  marketing_email_opt_in: boolean;
  channel_sms_opt_in: boolean;
  channel_whatsapp_opt_in: boolean;
  locale: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  label: string | null;
  recipient_name: string;
  phone: string | null;
  city: string;
  street: string;
  house_number: string;
  entrance: string | null;
  floor: string | null;
  apartment: string | null;
  zip: string | null;
  courier_notes: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConsentEvent {
  id: string;
  customer_id: string | null;
  email: string | null;
  phone: string | null;
  kind: 'marketing_email' | 'channel_sms' | 'channel_whatsapp' | 'terms';
  granted: boolean;
  source: 'checkout' | 'account' | 'thank_you' | 'unsubscribe_link' | 'staff';
  order_id: string | null;
  created_at: string;
}

export interface SavedBook {
  customer_id: string;
  book_id: string;
  is_favourite: boolean;
  shelf: ShelfKey | null;
  created_at: string;
  updated_at: string;
}

export interface Cart {
  id: string;
  customer_id: string;
  status: 'active' | 'merged' | 'converted' | 'expired';
  currency: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  cart_id: string;
  book_id: string;
  quantity: number;
  added_at: string;
}

export interface CheckoutSessionRecord {
  id: string;
  customer_id: string | null;
  status: 'open' | 'contact_entered' | 'abandoned' | 'converted' | 'expired';
  items: { book_id: string; quantity: number }[];
  contact_phone: string | null;
  contact_name: string | null;
  contact_email: string | null;
  fulfillment: {
    type?: FulfillmentType;
    method_id?: string;
    address?: Partial<ShippingAddress>;
    courier_notes?: string;
  };
  is_gift: boolean;
  gift_recipient_name: string | null;
  gift_message: string | null;
  gift_hide_prices: boolean;
  coupon_code: string | null;
  donation_amount: number | null;
  is_express: boolean;
  express_wallet: 'bit' | 'apple_pay' | 'google_pay' | null;
  notify_channel: 'sms' | 'whatsapp' | null;
  terms_accepted_at: string | null;
  idempotency_key: string;
  order_id: string | null;
  locale: string;
  abandoned_email_sent_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ShippingMethodKind = 'pickup' | 'flat' | 'by_weight' | 'by_total' | 'free_over';

export interface ShippingMethod {
  id: string;
  slug: string;
  name_he: string;
  name_en: string | null;
  description_he: string | null;
  description_en: string | null;
  kind: ShippingMethodKind;
  price: number;
  free_over: number | null;
  min_weight_grams: number | null;
  max_weight_grams: number | null;
  min_total: number | null;
  max_total: number | null;
  zone_id: string | null;
  eta_business_days: number;
  price_includes_vat: boolean;
  valid_from: string | null;
  valid_until: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface StockLocation {
  id: string;
  slug: string;
  name: string;
  kind: 'warehouse' | 'office' | 'pickup_point' | 'distributor' | 'temp';
  is_default: boolean;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface InventoryLevel {
  book_id: string;
  location_id: string;
  on_hand: number;
  reserved: number;
  updated_at: string;
}

export type InventoryMoveType =
  | 'receive'
  | 'sale'
  | 'cancel_restock'
  | 'return_restock'
  | 'damage'
  | 'manual_adjust'
  | 'transfer_in'
  | 'transfer_out'
  | 'count'
  | 'reserve'
  | 'release';

export interface InventoryMove {
  id: string;
  book_id: string;
  location_id: string;
  move_type: InventoryMoveType;
  quantity_delta: number;
  on_hand_before: number;
  on_hand_after: number;
  reserved_before: number;
  reserved_after: number;
  reason: string | null;
  order_id: string | null;
  order_item_id: string | null;
  actor_type: ActorType;
  actor_id: string | null;
  note: string | null;
  created_at: string;
}

export interface StoreSettings {
  id: number;
  show_prices: boolean;
  cart_enabled: boolean;
  checkout_enabled: boolean;
  payments_enabled: boolean;
  express_checkout_enabled: boolean;
  coupons_enabled: boolean;
  accounts_enabled: boolean;
  returns_enabled: boolean;
  recommendations_enabled: boolean;
  donations_enabled: boolean;
  free_shipping_threshold: number | null;
  installments_min_total: number;
  installments_max: number;
  vat_mode: 'exempt' | 'included';
  vat_rate: number;
  document_type: DocumentType;
  order_prep_days: number;
  delivery_buffer_days: number;
  non_working_dates: string[];
  pickup_enabled: boolean;
  pickup_address: Record<string, string>;
  pickup_hours: string | null;
  pickup_prep_hours: number;
  support_phone: string | null;
  low_stock_threshold: number;
  guest_link_ttl_days: number;
  abandoned_after_minutes: number;
  abandoned_retention_days: number;
  add_to_order_window_hours: number;
  updated_at: string;
}

export interface NotificationLogEntry {
  id: string;
  order_id: string | null;
  customer_id: string | null;
  template: string;
  channel: 'email' | 'sms' | 'whatsapp';
  recipient: string;
  provider: string | null;
  provider_message_id: string | null;
  status: 'queued' | 'sent' | 'failed' | 'skipped';
  attempts: number;
  error: string | null;
  idempotency_key: string;
  created_at: string;
  sent_at: string | null;
}
