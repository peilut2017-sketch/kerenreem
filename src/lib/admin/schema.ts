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

const f = (name: string, type: FieldType = 'text', required = false): FieldSpec => ({
  name,
  type,
  required,
});

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
      f('sort_order', 'number'),
    ],
    revalidate: ['/books', '/books/[slug]', ''],
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
      f('sort_order', 'number'),
      f('is_published', 'boolean'),
    ],
    revalidate: ['/authors', '/authors/[slug]'],
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
      f('gallery', 'json'),
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
      f('sort_order', 'number'),
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

  categories: {
    table: 'categories',
    writeRole: 'editor',
    fields: [f('slug', 'text', true), f('name_he', 'text', true), f('name_en'), f('sort_order', 'number')],
    revalidate: ['/books', '/books/[slug]'],
  },
} satisfies Record<string, EntitySpec>;

export type EntityKey = keyof typeof ENTITIES;

export function isEntityKey(value: string): value is EntityKey {
  return Object.hasOwn(ENTITIES, value);
}
