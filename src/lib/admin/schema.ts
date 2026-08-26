import type { ScreenKey } from './screens';

/**
 * הגדרת הישויות הניתנות לעריכה.
 *
 * כל שדה שאינו מופיע כאן לא ייכתב למסד, גם אם יישלח בטופס. זו ההגנה מפני
 * mass assignment: בלי רשימה סגורה, טופס ערוך יכול לדרוס שדות שלא נועדו
 * לעריכה (למשל id או created_at).
 */

export type FieldType =
  | 'text'
  | 'html'
  | 'number'
  | 'boolean'
  | 'date'
  | 'json'
  | 'uuid'
  /** מערך מחרוזות בעמודה אחת (text[]), למשל שפות הספר */
  | 'text[]';

export interface FieldSpec {
  name: string;
  type: FieldType;
  /** שדה חובה — נבדק בשרת, לא רק ב-HTML */
  required?: boolean;
  /**
   * להשמיט מה-payload כשהערך ריק, במקום לכתוב null.
   *
   * נדרש לעמודות not null שיש להן default: ברירת המחדל חלה רק כשהעמודה
   * מושמטת מה-INSERT. שליחת null מפורש דוחה אותה ומפילה את השמירה ב-23502,
   * ולכן שדה רשות כזה היה נכשל בדיוק כשמשאירים אותו ריק — המצב הנפוץ.
   */
  omitWhenEmpty?: boolean;
}

/**
 * טבלת קישור שמסונכרנת עם הישות.
 *
 * הטופס שולח את המזהים שנבחרו, והשמירה מוחקת את הקיימים ומכניסה את
 * החדשים. סנכרון מלא ולא הפרש: הפרש דורש לדעת מה היה קודם, וטופס שנפתח
 * בשתי לשוניות היה מוחק בחירות שנעשו בשנייה.
 */
export interface RelationSpec {
  /** שם השדה בטופס */
  field: string;
  /** טבלת הקישור */
  table: string;
  /** העמודה שמצביעה על הישות */
  ownerColumn: string;
  /** העמודה שמצביעה על הצד השני */
  targetColumn: string;
}

export interface EntitySpec {
  table: string;
  /** [1.7] מסך ההרשאה הגרגרי (screens.ts) — assertScreenPermission(screenKey, 'edit') */
  screenKey: ScreenKey;
  fields: FieldSpec[];
  /**
   * מסלולים ציבוריים לרענון אחרי שמירה, **כתבניות נתיב** ולא ככתובות ממשיות.
   *
   * revalidatePath מצפה לתבנית המסלול כפי שהיא בעץ הקבצים. העברת סלאג ממשי
   * (למשל '/books/my-book') אינה זורקת שגיאה אבל גם אינה עושה דבר — הרענון
   * נכשל בשקט והעמוד הציבורי נשאר ישן עד שפג ה-ISR. לכן כאן מופיע
   * '/books/[slug]', שמרענן את כל עמודי הספרים.
   *
   * המחרוזת הריקה מייצגת את עמוד הבית (/[locale]).
   */
  revalidate: string[];
  /** טבלאות קישור לסנכרון אחרי השמירה */
  relations?: RelationSpec[];
}

const f = (
  name: string,
  type: FieldType = 'text',
  required = false,
  omitWhenEmpty = false,
): FieldSpec => ({ name, type, required, omitWhenEmpty });

/** שדה רשות שמגובה בעמודת not null עם default. */
const fd = (name: string, type: FieldType = 'text'): FieldSpec => f(name, type, false, true);

export const ENTITIES = {
  books: {
    table: 'books',
    screenKey: 'books',
    fields: [
      // אינו חובה — ספר בלי מזהה מקבל אחד אוטומטית בשמירה (ראו actions.ts)
      f('slug'),
      f('title_he', 'text', true),
      f('title_en'),
      f('subtitle_he'),
      f('subtitle_en'),
      f('description_he', 'html'),
      f('description_en', 'html'),
      f('description_brief_he'),
      f('description_brief_en'),
      f('author_id', 'uuid'),
      // מחבר כטקסט חופשי (19_book_author_freetext.sql) — גובר על author_id
      // בתצוגה, בלי ליצור או לגעת ברשומת מחבר. ראו lib/books/author-display.ts.
      f('author_name_he'),
      f('author_name_en'),
      // [1.21] נגזר בשרת מ-category_ids (הבחירה המרובה) ולא מוזן ישירות
      // בטופס — ראו saveEntity ב-actions.ts. fd ולא f: אם מסיבה כלשהי
      // formData לא כולל category_ids כלל, לא רוצים לאפס את מה שהיה.
      fd('category_id', 'uuid'),
      f('series_id', 'uuid'),
      // [1.10] fd ולא f: המיקום נקבע בגרירה (SeriesOrderList/saveSeriesOrder),
      // לא בטופס הזה. השמטת השדה מהטופס משאירה null בעדכון "אל תיגע" —
      // אחרת כל שמירה של הספר (גם על שדה אחר לגמרי) הייתה מאפסת את הסדר.
      fd('series_position', 'number'),
      f('publication_year_he'),
      f('publication_year_ce', 'number'),
      f('cover_image_url'),
      f('spine_image_url'),
      f('pages', 'number'),
      f('format'),
      f('binding'),
      f('isbn'),
      f('volume_count', 'number'),
      f('sample_pdf_url'),
      f('price', 'number'),
      f('currency'),
      f('sku'),
      // fd ולא f: שדה מלאי ריק משאיר את ה-default של המסד (0), לא כותב null
      fd('stock_quantity', 'number'),
      f('is_purchasable', 'boolean'),
      f('weight_grams', 'number'),
      f('stock_location'),
      f('physical_size'),
      // הרחבות המסחר (26_books_commerce_extension.sql)
      f('sale_price', 'number'),
      f('sale_starts_at', 'date'),
      f('sale_ends_at', 'date'),
      f('sale_name_he'),
      f('is_stock_managed', 'boolean'),
      f('low_stock_threshold', 'number'),
      f('barcode'),
      f('free_shipping_eligible', 'boolean'),
      f('is_published', 'boolean'),
      f('languages', 'text[]'),
      f('cover_alt'),
      f('meta_title'),
      f('meta_description'),
      f('og_image_url'),
      f('canonical_url'),
      f('search_keywords'),
      f('quotes', 'text[]'),
      // שלב ד׳ — מרחב הגילוי (14_book_page_v3.sql)
      f('publisher_he'),
      f('publisher_en'),
      f('edition_he'),
      f('edition_en'),
      f('accent_primary'),
      f('accent_secondary'),
      f('is_featured', 'boolean'),
      f('preorder_enabled', 'boolean'),
      f('preorder_release_date', 'date'),
      // הדמיית כריכה ל-Hero (15_book_flip_preview.sql)
      f('hero_mockup_url'),
      // [1.9] רכישה דרך ספק חיצוני (42_external_supplier.sql)
      f('external_supplier_enabled', 'boolean'),
      f('external_supplier_url'),
      f('external_supplier_name'),
      f('external_supplier_always_show', 'boolean'),
    ],
    relations: [
      { field: 'tag_ids', table: 'book_tags', ownerColumn: 'book_id', targetColumn: 'tag_id' },
      {
        field: 'category_ids',
        table: 'book_categories',
        ownerColumn: 'book_id',
        targetColumn: 'category_id',
      },
      {
        field: 'attribute_value_ids',
        table: 'book_attributes',
        ownerColumn: 'book_id',
        targetColumn: 'value_id',
      },
    ],
    // ספר מופיע גם במסכי המחברים: עמוד המחבר מציג את ספריו, ומדד הספרים
    // ברשימת המחברים נספר מהם. בלי שני אלה ספר חדש נראה בקטלוג אבל לא
    // אצל המחבר שלו, עד שפג ה-ISR.
    revalidate: ['/books', '/books/[slug]', '/authors', '/authors/[slug]', ''],
  },

  authors: {
    table: 'authors',
    screenKey: 'authors',
    fields: [
      f('slug', 'text', true),
      f('name_he', 'text', true),
      f('name_en'),
      f('bio_he', 'html'),
      f('bio_en', 'html'),
      f('portrait_url'),
      f('birth_year'),
      f('death_year'),
      fd('timeline', 'json'),
      fd('sort_order', 'number'),
      f('is_published', 'boolean'),
    ],
    // שם המחבר מוצג גם בעמוד הספר, בכרטיסי הקטלוג ובספרים המומלצים בדף
    // הבית, והוא משמש כמסנן בקטלוג. שינוי שם שמתעדכן רק במסכי המחברים
    // משאיר את כל אלה עם השם הישן.
    revalidate: ['/authors', '/authors/[slug]', '/books', '/books/[slug]', ''],
  },

  events: {
    table: 'events',
    screenKey: 'events',
    fields: [
      f('slug', 'text', true),
      f('title_he', 'text', true),
      f('title_en'),
      f('event_date', 'date'),
      f('event_date_he'),
      f('body_he', 'html'),
      f('body_en', 'html'),
      f('cover_image_url'),
      f('featured_video_url'),
      fd('gallery', 'json'),
      f('is_published', 'boolean'),
    ],
    revalidate: ['/events', '/events/[slug]', ''],
  },

  activities: {
    table: 'activities',
    screenKey: 'activities',
    fields: [
      f('slug', 'text', true),
      f('title_he', 'text', true),
      f('title_en'),
      f('summary_he'),
      f('summary_en'),
      f('body_he', 'html'),
      f('body_en', 'html'),
      f('icon'),
      f('cover_image_url'),
      fd('sort_order', 'number'),
      f('is_published', 'boolean'),
    ],
    revalidate: ['/activities', '/activities/[slug]', ''],
  },

  pages: {
    table: 'pages',
    screenKey: 'pages',
    fields: [
      f('slug', 'text', true),
      f('title_he', 'text', true),
      f('title_en'),
      f('body_he', 'html'),
      f('body_en', 'html'),
      f('is_published', 'boolean'),
    ],
    // עמודי התוכן הם מסלולים סטטיים (/about, /terms...). 'home' אינו מסלול
    // בפני עצמו אלא משפט הפתיחה בעמוד הבית, ולכן די ברענון השורש.
    revalidate: ['/about', '/terms', '/privacy', '/accessibility', ''],
  },

  banners: {
    table: 'banners',
    screenKey: 'banners',
    fields: [
      f('title_he', 'text', true),
      f('title_en'),
      f('subtitle_he'),
      f('subtitle_en'),
      f('image_url'),
      f('image_mobile_url'),
      fd('focal_point'),
      f('link_url'),
      f('cta_label_he'),
      f('cta_label_en'),
      f('is_published', 'boolean'),
      fd('sort_order', 'number'),
      f('starts_at', 'text'),
      f('ends_at', 'text'),
    ],
    revalidate: [''],
  },

  categories: {
    table: 'categories',
    screenKey: 'categories',
    fields: [f('slug', 'text', true), f('name_he', 'text', true), f('name_en'), fd('sort_order', 'number')],
    // הרשימה נגזרת מהשאילתות ולא ממה שמוצג בפועל, ולכן היא רחבה מהנדרש:
    // הקטגוריה מצורפת לכל שליפת ספרים גם במסלולים שאינם מציגים את שמה.
    // רענון תבנית מסלול הוא זול, ובחירה ברשימה מדויקת הייתה מחייבת רשימת
    // חריגים שתתיישן ברגע שמישהו יציג את שם הקטגוריה במקום נוסף.
    revalidate: ['/books', '/books/[slug]', '/authors', '/authors/[slug]', ''],
  },

  series: {
    table: 'series',
    screenKey: 'series',
    fields: [f('slug', 'text', true), f('name_he', 'text', true), f('name_en'), f('description_he')],
    revalidate: ['/books', '/books/[slug]', ''],
  },

  tags: {
    table: 'tags',
    screenKey: 'tags',
    fields: [f('slug', 'text', true), f('name_he', 'text', true), f('name_en'), f('description_he')],
    // is_system אינו כאן: הוא נקבע פעם אחת ביצירה (תגיות מערכת נזרעות
    // בקוד, ראו 08_pim_stage_a.sql) ואינו אמור להיות שדה שעורך יכול לשנות.
    revalidate: ['/books', '/books/[slug]', ''],
  },

  contact_topics: {
    table: 'contact_topics',
    screenKey: 'contact-topics',
    fields: [
      f('name_he', 'text', true),
      f('name_en'),
      fd('sort_order', 'number'),
      f('is_published', 'boolean'),
    ],
    revalidate: ['/contact'],
  },

  contact_fields: {
    table: 'contact_fields',
    screenKey: 'contact-fields',
    fields: [
      f('label_he', 'text', true),
      f('label_en'),
      f('field_type', 'text', true),
      f('options_he'),
      f('options_en'),
      f('is_required', 'boolean'),
      fd('sort_order', 'number'),
      f('is_published', 'boolean'),
    ],
    revalidate: ['/contact'],
  },
} satisfies Record<string, EntitySpec>;

export type EntityKey = keyof typeof ENTITIES;

export function isEntityKey(value: string): value is EntityKey {
  return Object.hasOwn(ENTITIES, value);
}
