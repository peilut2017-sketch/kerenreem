/**
 * טיפוסי מסד הנתונים — משקפים את supabase/schema.sql.
 * בשינוי סכימה יש לעדכן כאן (או לייצר מחדש עם `supabase gen types typescript`).
 */

export type UserRole = 'admin' | 'editor' | 'viewer';

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
  author_id: string | null;
  category_id: string | null;
  publication_year_he: string | null;
  publication_year_ce: number | null;
  cover_image_url: string | null;
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
  created_at: string;
  updated_at: string;
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
