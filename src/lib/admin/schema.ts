import type { UserRole } from '@/lib/supabase/types';

/**
 * הגדרת הישויות הניתנות לעריכה.
 *
 * כל שדה שאינו מופיע כאן לא ייכתב למסד, גם אם יישלח בטופס. זו ההגנה מפני
 * mass assignment: בלי רשימה סגורה, טופס ערוך יכול לדרוס שדות שלא נועדו
 * לעריכה (למשל id או created_at).
 */

export type FieldType = 'text' | 'html' | 'number' | 'boolean' | 'date' | 'json' | 'uuid';

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

export interface EntitySpec {
  table: string;
  /** התפקיד המינימלי הנדרש לכתיבה */
  writeRole: UserRole;
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
    writeRole: 'editor',
    fields: [
      f('slug', 'text', true),
      f('title_he', 'text', true),
      f('title_en'),
      f('subtitle_he'),
      f('subtitle_en'),
      f('description_he', 'html'),
      f('description_en', 'html'),
      f('author_id', 'uuid'),
      f('category_id', 'uuid'),
      f('publication_year_he'),
      f('publication_year_ce', 'number'),
      f('cover_image_url'),
      f('pages', 'number'),
      f('format'),
      f('binding'),
      f('isbn'),
      f('volume_count', 'number'),
      f('sample_pdf_url'),
      f('price', 'number'),
      f('currency'),
      f('sku'),
      f('stock_quantity', 'number'),
      f('is_purchasable', 'boolean'),
      f('weight_grams', 'number'),
      f('is_published', 'boolean'),
      fd('sort_order', 'number'),
    ],
    // ספר מופיע גם במסכי המחברים: עמוד המחבר מציג את ספריו, ומדד הספרים
    // ברשימת המחברים נספר מהם. בלי שני אלה ספר חדש נראה בקטלוג אבל לא
    // אצל המחבר שלו, עד שפג ה-ISR.
    revalidate: ['/books', '/books/[slug]', '/authors', '/authors/[slug]', ''],
  },

  authors: {
    table: 'authors',
    writeRole: 'editor',
    fields: [
      f('slug', 'text', true),
      f('name_he', 'text', true),
      f('name_en'),
      f('bio_he', 'html'),
      f('bio_en', 'html'),
      f('portrait_url'),
      f('birth_year'),
      f('death_year'),
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
    writeRole: 'editor',
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
    writeRole: 'editor',
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
    writeRole: 'editor',
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
    revalidate: ['/about', '/donate', '/terms', '/privacy', '/accessibility', ''],
  },

  banners: {
    table: 'banners',
    writeRole: 'editor',
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
    writeRole: 'editor',
    fields: [f('slug', 'text', true), f('name_he', 'text', true), f('name_en'), fd('sort_order', 'number')],
    // הרשימה נגזרת מהשאילתות ולא ממה שמוצג בפועל, ולכן היא רחבה מהנדרש:
    // הקטגוריה מצורפת לכל שליפת ספרים גם במסלולים שאינם מציגים את שמה.
    // רענון תבנית מסלול הוא זול, ובחירה ברשימה מדויקת הייתה מחייבת רשימת
    // חריגים שתתיישן ברגע שמישהו יציג את שם הקטגוריה במקום נוסף.
    revalidate: ['/books', '/books/[slug]', '/authors', '/authors/[slug]', ''],
  },
} satisfies Record<string, EntitySpec>;

export type EntityKey = keyof typeof ENTITIES;

export function isEntityKey(value: string): value is EntityKey {
  return Object.hasOwn(ENTITIES, value);
}
