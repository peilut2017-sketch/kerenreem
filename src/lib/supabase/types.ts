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
  tags?: Pick<Tag, 'id' | 'slug' | 'name_he' | 'name_en'>[];
  attributeValues?: Pick<AttributeValue, 'id' | 'slug' | 'name_he' | 'attribute_id'>[];
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
  gallery: GalleryImage[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
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
