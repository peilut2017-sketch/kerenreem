'use server';

import { createClient } from '@/lib/supabase/server';
import { assertScreenPermission } from './auth';
import { AUDIT_ACTION_LABELS } from './audit-log-queries';

/**
 * [1.40] יומן הפעולות של ספר בודד — כל יצירה ועריכה שנעשו בו, מי עשה
 * אותן, מתי, ומה בדיוק השתנה.
 *
 * למה שאילתה משלו ולא סינון של מסך יומן הביקורת הכללי: הרשומות ששייכות
 * לספר אחד מפוזרות על פני כמה טבלאות — הספר עצמו (books), הגלריה
 * (book_images), תוכן העניינים (book_toc), דפי הדפדוף
 * (book_preview_pages) והעלויות (book_costs). מה שמאחד אותן הוא דווקא
 * record_id: כל נקודות הכתיבה של טבלאות-הבת רושמות בו את *מזהה הספר*
 * ולא את מזהה השורה שהשתנתה (ראו saveBookImages וחבריו ב-actions.ts),
 * בדיוק כדי שאפשר יהיה לשאול "מה קרה לספר הזה" בשאילתה אחת.
 *
 * נטען לפי דרישה, כשנפתחת הלשונית, ולא עם שאר נתוני הכרטיס: זו רשימה
 * שגדלה עם הזמן ורוב פתיחות הכרטיס אינן נוגעות בה, ואין סיבה להאט
 * בגללה את פתיחת הטופס.
 */

/** תקרה: מעבר לכך זו כבר חקירה, ומקומה במסך יומן הביקורת המלא. */
const LIMIT = 200;

export interface BookActivityChange {
  /** שם העמודה כפי שהוא במסד — לזיהוי, ולנפילה חזרה כשאין תווית. */
  field: string;
  label: string;
  before: string | null;
  after: string | null;
}

export interface BookActivityEntry {
  id: string;
  createdAt: string;
  action: string;
  actionLabel: string;
  /** "גלריה", "תוכן עניינים" — איזה חלק של הספר נגע בו, null לספר עצמו. */
  area: string | null;
  actorName: string;
  context: string | null;
  changes: BookActivityChange[];
  /** מספר השדות שהשתנו מעבר לאלה שהוחזרו (ערכים שלא ניתן להציג). */
  hiddenChangeCount: number;
}

export interface BookActivityResult {
  entries: BookActivityEntry[];
  error?: string;
  /** true כשהוחזרה התקרה — יש עוד היסטוריה מעבר לה. */
  truncated: boolean;
}

/** הטבלאות שרשומה שלהן עם record_id של ספר שייכת לספר הזה. */
const BOOK_TABLES = ['books', 'book_images', 'book_toc', 'book_preview_pages', 'book_costs'];

const AREA_LABELS: Record<string, string> = {
  books: '',
  book_images: 'גלריה',
  book_toc: 'תוכן עניינים',
  book_preview_pages: 'דפי דפדוף',
  book_costs: 'עלויות',
};

/**
 * תוויות עבריות לעמודות הספר. הרשימה ידנית ולא נגזרת מ-schema.ts
 * מכוונת: ה-spec מחזיק שם עמודה וטיפוס בלבד, בעוד שהתוויות שהעורך
 * מכיר חיות בטופס עצמו (BookForm) כטקסט בתוך JSX. עמודה שאינה כאן
 * מוצגת בשמה הטכני — עדיף משדה שנעלם מהיומן.
 */
const FIELD_LABELS: Record<string, string> = {
  title_he: 'שם הספר',
  title_en: 'שם הספר (אנגלית)',
  subtitle_he: 'כותרת משנה',
  subtitle_en: 'כותרת משנה (אנגלית)',
  slug: 'מזהה כתובת',
  sku: 'מק״ט',
  isbn: 'מסת״ב',
  barcode: 'ברקוד',
  description_he: 'תיאור הספר',
  description_en: 'תיאור הספר (אנגלית)',
  description_brief_he: 'תמצית קצרה',
  description_brief_en: 'תמצית קצרה (אנגלית)',
  author_id: 'מחבר',
  author_name_he: 'שם מחבר (טקסט)',
  category_id: 'קטגוריה ראשית',
  series_id: 'סדרה',
  series_position: 'מיקום בסדרה',
  volume_count: 'מספר כרכים',
  publication_year_he: 'שנה עברית',
  publication_year_ce: 'שנה לועזית',
  publisher_he: 'הוצאה לאור',
  edition_he: 'מהדורה',
  pages: 'מספר עמודים',
  binding: 'סוג כריכה',
  languages: 'שפות',
  physical_size: 'גודל',
  weight_grams: 'משקל (גרם)',
  cover_image_url: 'תמונת כריכה',
  cover_alt: 'טקסט חלופי לכריכה',
  spine_image_url: 'תמונת שדרה',
  hero_mockup_url: 'תמונת תצוגה',
  sample_pdf_url: 'קובץ דפדוף',
  accent_primary: 'גוון ראשי',
  accent_secondary: 'גוון משני',
  quotes: 'ציטוטים',
  price: 'מחיר',
  sale_price: 'מחיר מבצע',
  sale_starts_at: 'תחילת המבצע',
  sale_ends_at: 'סיום המבצע',
  sale_name_he: 'שם המבצע',
  currency: 'מטבע',
  is_purchasable: 'ניתן לרכישה',
  is_published: 'מפורסם',
  is_stock_managed: 'מלאי מנוהל',
  stock_quantity: 'מלאי',
  low_stock_threshold: 'סף מלאי נמוך',
  stock_location: 'מיקום מדף',
  free_shipping_eligible: 'נספר לסף משלוח חינם',
  preorder_enabled: 'הזמנה מראש',
  preorder_release_date: 'תאריך יציאה משוער',
  prep_days_override: 'ימי הכנה',
  external_supplier_enabled: 'מכירה דרך ספק חיצוני',
  external_supplier_url: 'קישור לספק',
  external_supplier_name: 'שם הספק',
  external_supplier_always_show: 'הצגת כפתור הספק תמיד',
  meta_title: 'כותרת SEO',
  meta_description: 'תיאור SEO',
  catalogue_number: 'מספר בקטלוג',
};

/** ערך גולמי מהיומן → טקסט קריא. ‎null אמיתי מוצג כ"(ריק)" ולא כ-"null". */
function present(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 'כן' : 'לא';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : null;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export async function getBookActivity(bookId: string): Promise<BookActivityResult> {
  // אותה הרשאה שנדרשת לצפות בכרטיס הספר עצמו — היומן אינו חושף כאן
  // דבר שאינו כבר בטופס, פרט לשם מי שביצע.
  const session = await assertScreenPermission('books', 'view');
  if ('error' in session) return { entries: [], error: session.error, truncated: false };

  const supabase = await createClient();
  if (!supabase) return { entries: [], error: 'אין חיבור למסד', truncated: false };

  const { data, error } = await supabase
    .from('audit_log')
    .select('id, user_id, action, table_name, context, old_values, new_values, created_at')
    .eq('record_id', bookId)
    .in('table_name', BOOK_TABLES)
    .order('created_at', { ascending: false })
    .limit(LIMIT);

  if (error) {
    console.error('[admin:bookActivity]', error.code, error.message);
    return { entries: [], error: `${error.code ?? '—'}: ${error.message}`, truncated: false };
  }

  const rows = data ?? [];

  // שמות המבצעים בשליפה אחת, לא אחת לכל שורה.
  const userIds = [...new Set(rows.map((row) => row.user_id).filter((id): id is string => Boolean(id)))];
  const nameById = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);
    for (const profile of profiles ?? []) {
      nameById.set(profile.id, profile.full_name ?? '—');
    }
  }

  const entries: BookActivityEntry[] = rows.map((row) => {
    const before = (row.old_values ?? {}) as Record<string, unknown>;
    const after = (row.new_values ?? {}) as Record<string, unknown>;

    // השדות שהשתנו הם אלה שב-new_values (ראו diffForAudit — הוא כבר
    // סינן שם כל שדה שערכו לא השתנה בפועל).
    const fields = Object.keys(after);
    const changes: BookActivityChange[] = fields.map((field) => ({
      field,
      label: FIELD_LABELS[field] ?? field,
      before: present(before[field]),
      after: present(after[field]),
    }));

    return {
      id: row.id,
      createdAt: row.created_at,
      action: row.action,
      actionLabel: AUDIT_ACTION_LABELS[row.action] ?? row.action,
      area: AREA_LABELS[row.table_name] || null,
      actorName: row.user_id ? (nameById.get(row.user_id) ?? 'משתמש שהוסר') : 'המערכת',
      context: row.context,
      changes,
      // המקום היחיד שבו ייתכן פער: ערך ארוך שנקטם (ראו compactAuditValues)
      // עדיין נספר כשינוי — אין כאן היום שדות שנשמטים, ולכן 0.
      hiddenChangeCount: 0,
    };
  });

  return { entries, truncated: rows.length === LIMIT };
}
