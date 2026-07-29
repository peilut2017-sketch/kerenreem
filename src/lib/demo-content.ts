import type {
  Activity,
  Banner,
  Author,
  BookWithRelations,
  Category,
  ContentPage,
  EventRecord,
  SiteSettings,
} from './supabase/types';

/**
 * תוכן תצוגה — לפיתוח ולסקירת עיצוב בלבד.
 *
 * מופעל רק כששני התנאים מתקיימים: אין חיבור ל-Supabase, והמשתנה
 * NEXT_PUBLIC_DEMO_CONTENT מוגדר ל-1. בסביבה אמיתית, שבה יש חיבור למסד,
 * הקוד הזה לעולם אינו רץ.
 *
 * הצילומים והכריכות תחת public/demo הם מצייני מקום מסומנים ("יש להחליף
 * בצילום אמיתי") ולא תמונות מלאי — כדי שלא יגיעו בטעות לאתר החי.
 */

export const isDemoContent =
  process.env.NEXT_PUBLIC_DEMO_CONTENT === '1' && !process.env.NEXT_PUBLIC_SUPABASE_URL;

const now = new Date().toISOString();

const base = { created_at: now, updated_at: now };

const categories: Category[] = [
  { id: 'c1', slug: 'halacha', name_he: 'הלכה ושו״ת', name_en: 'Halacha', sort_order: 10, ...base },
  { id: 'c2', slug: 'moadim', name_he: 'מועדים', name_en: 'Festivals', sort_order: 20, ...base },
  { id: 'c3', slug: 'machshava', name_he: 'מחשבה ומוסר', name_en: 'Thought', sort_order: 30, ...base },
];

const authors: Author[] = [
  {
    id: 'a1', slug: 'raam-hacohen', name_he: 'הרב רא״ם הכהן', name_en: null,
    bio_he: '<p>מחבר ועורך, מן הכותבים המרכזיים שהמכון מוציא לאור.</p>', bio_en: null,
    portrait_url: null, birth_year: 'תש״ח', death_year: null,
    sort_order: 10, is_published: true, ...base,
  },
  {
    id: 'a2', slug: 'avraham-kook', name_he: 'הרב אברהם קוק', name_en: null,
    bio_he: '<p>מכתביו ההדיר המכון כמה מהדורות.</p>', bio_en: null,
    portrait_url: null, birth_year: 'תרכ״ה', death_year: 'תרצ״ה',
    sort_order: 20, is_published: true, ...base,
  },
];

function book(
  id: string, slug: string, title: string, subtitle: string | null,
  cover: string, authorIndex: number, categoryIndex: number,
  yearHe: string, yearCe: number,
): BookWithRelations {
  const author = authors[authorIndex];
  const category = categories[categoryIndex];
  return {
    id, slug, title_he: title, title_en: null,
    subtitle_he: subtitle, subtitle_en: null,
    description_he: `<p>${subtitle ?? title} — מהדורה מוערת בהוצאת המכון.</p>`,
    description_en: null,
    author_id: author.id, category_id: category.id,
    publication_year_he: yearHe, publication_year_ce: yearCe,
    cover_image_url: `/demo/cover-${cover}.svg`,
    pages: 412, format: 'פוליו', binding: 'כריכה קשה', isbn: null,
    volume_count: 1, sample_pdf_url: null,
    price: null, currency: 'ILS', sku: null, stock_quantity: 0,
    is_purchasable: false, weight_grams: null,
    is_published: true, sort_order: 0, ...base,
    author: { id: author.id, slug: author.slug, name_he: author.name_he, name_en: author.name_en },
    category: { id: category.id, slug: category.slug, name_he: category.name_he, name_en: category.name_en },
  };
}

const books: BookWithRelations[] = [
  book('b1', 'pnei-hamoadim', 'פני המועדים', 'ביאורים מאירים על מועדי התורה', 'pnei-hamoadim', 0, 1, 'תשפ״ו', 2026),
  book('b2', 'or-hahalacha', 'אור ההלכה', 'בירורי הלכה למעשה', 'or-hahalacha', 0, 0, 'תשפ״ד', 2024),
  book('b3', 'mishkan-even', 'משכן אבנה', null, 'mishkan-even', 1, 2, 'תשפ״ג', 2023),
  book('b4', 'likutei-dvarim', 'לקט דברי ראם', null, 'likutei-dvarim', 0, 2, 'תשפ״ב', 2022),
  book('b5', 'machzik-yedidim', 'מחזיק ידידים', null, 'machzik-yedidim', 1, 0, 'תשפ״א', 2021),
];

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const events: EventRecord[] = [
  {
    id: 'e1', slug: 'kenes-achdut', title_he: 'כנס אחדות ירושלים', title_en: null,
    event_date: daysFromNow(21), event_date_he: 'ט״ו באב',
    body_he: '<p>כנס שנתי שבו נפגשים ראשי ישיבות מכל החוגים, לזכר רבי אליהו מרדכי זוננפלד.</p>',
    body_en: null, cover_image_url: '/demo/scene-kenes-achdut.svg',
    featured_video_url: null, gallery: [], is_published: true, ...base,
  },
  {
    id: 'e2', slug: 'siyum-hashas', title_he: 'סיום הש״ס המרכזי', title_en: null,
    event_date: daysFromNow(-14), event_date_he: null,
    body_he: '<p>מעמד סיום הש״ס של לומדי הכוללים שהמכון תומך בהם.</p>',
    body_en: null, cover_image_url: '/demo/scene-siyum-hashas.svg',
    featured_video_url: null, gallery: [], is_published: true, ...base,
  },
  {
    id: 'e3', slug: 'slichot', title_he: 'טיול סליחות בבתי ירושלים', title_en: null,
    event_date: daysFromNow(-48), event_date_he: null,
    body_he: '<p>סיור לילי בבתי הכנסת העתיקים של ירושלים.</p>',
    body_en: null, cover_image_url: '/demo/scene-slichot.svg',
    featured_video_url: null, gallery: [], is_published: true, ...base,
  },
];

const activities: Activity[] = [
  {
    id: 'ac1', slug: 'publishing', title_he: 'הוצאה לאור', title_en: null,
    summary_he: 'ההדרה, עריכה והפקה מחודשת של כתבי גדולי ישראל — למעלה ממאה כותרים.',
    summary_en: null, body_he: '<p>ליבת פעילותו של המכון.</p>', body_en: null,
    icon: 'book-open', cover_image_url: '/demo/scene-beit-midrash.svg',
    sort_order: 10, is_published: true, ...base,
  },
  {
    id: 'ac2', slug: 'torah-support', title_he: 'תמיכה ואחזקת תורה', title_en: null,
    summary_he: 'תמיכה בישיבות, כוללים ולומדים, בדגש על מוסדות שאינם מקבלים סבסוד.',
    summary_en: null, body_he: '<p>מתוך חזון של אחדות.</p>', body_en: null,
    icon: 'academic-cap', cover_image_url: null, sort_order: 20, is_published: true, ...base,
  },
  {
    id: 'ac3', slug: 'chesed', title_he: 'צדקה וחסד', title_en: null,
    summary_he: 'תמיכה במעוטי יכולת, באלמנות וביתומים, וסיוע בהכנסת כלה.',
    summary_en: null, body_he: '<p>לצד הפעילות התורנית.</p>', body_en: null,
    icon: 'heart', cover_image_url: null, sort_order: 30, is_published: true, ...base,
  },
  {
    id: 'ac4', slug: 'sefer-torah', title_he: 'ספר תורה ומורשת', title_en: null,
    summary_he: 'כתיבת ספר תורה לעילוי נשמה, ואירוע מרכזי שנתי בט״ו באב.',
    summary_en: null, body_he: '<p>הנצחת המורשת.</p>', body_en: null,
    icon: 'scroll', cover_image_url: null, sort_order: 40, is_published: true, ...base,
  },
];

const pages: Record<string, ContentPage> = {
  home: {
    id: 'p0', slug: 'home', title_he: 'משפט הפתיחה', title_en: null,
    body_he: '<p>הפצת תורה ברבים — בהוצאה לאור של כתבי גדולי ישראל, בתמיכה בלומדיה ובמעשי חסד.</p>',
    body_en: null, is_published: true, ...base,
  },
  about: {
    id: 'p1', slug: 'about', title_he: 'אודות מכון קרן רא״ם', title_en: null,
    body_he:
      '<p>מכון קרן רא״ם פועל מזה שנים להוצאה לאור של ספרי יסוד בתורה, ' +
      'לחיזוק עולם התורה ולהעמקת מעשי החסד בישראל. הקרן הוקמה בשנת תשנ״ג ' +
      'במטרה לתמוך בישיבות שאינן מקבלות סבסוד, ומתוך חזון של אחדות בין כלל ' +
      'חלקי הציבור שומר המצוות.</p>',
    body_en: null, is_published: true, ...base,
  },
};

const settings: SiteSettings = {
  id: 1,
  logo_url: null,
  contact: {
    address_he: 'ירושלים, ישראל',
    email: 'info@kerenraam.org.il',
    phone: '02-9999999',
  },
  social_links: { facebook: 'https://example.com', youtube: 'https://example.com' },
  store_enabled: false,
  extra: {},
  updated_at: now,
};

const banners: Banner[] = [
  {
    id: 'bn1', title_he: 'ספר חדש: פני המועדים', title_en: null,
    subtitle_he: 'ביאורים מאירים על מועדי התורה — מהדורה מוערת', subtitle_en: null,
    image_url: '/demo/scene-beit-midrash.svg', image_mobile_url: null,
    focal_point: 'center', link_url: '/books/pnei-hamoadim',
    cta_label_he: 'לפרטים על הספר', cta_label_en: null,
    is_published: true, sort_order: 10, starts_at: null, ends_at: null, ...base,
  },
  {
    id: 'bn2', title_he: 'כנס אחדות ירושלים', title_en: null,
    subtitle_he: 'ט״ו באב — ראשי ישיבות מכל החוגים נפגשים', subtitle_en: null,
    image_url: '/demo/scene-kenes-achdut.svg', image_mobile_url: null,
    focal_point: 'center', link_url: '/events/kenes-achdut',
    cta_label_he: 'לפרטי האירוע', cta_label_en: null,
    is_published: true, sort_order: 20, starts_at: null, ends_at: null, ...base,
  },
  {
    id: 'bn3', title_he: 'הוצאה לאור', title_en: null,
    subtitle_he: 'למעלה ממאה כותרים שהמכון סייע בהוצאתם', subtitle_en: null,
    image_url: '/demo/scene-siyum-hashas.svg', image_mobile_url: null,
    focal_point: 'center', link_url: '/activities/publishing',
    cta_label_he: 'לפעילות שלנו', cta_label_en: null,
    is_published: true, sort_order: 30, starts_at: null, ends_at: null, ...base,
  },
];

export const demo = {
  banners: () => banners,
  books: () => books,
  bookBySlug: (slug: string) => books.find((b) => b.slug === slug) ?? null,
  categories: () => categories,
  authors: () => authors,
  authorBySlug: (slug: string) => authors.find((a) => a.slug === slug) ?? null,
  booksByAuthor: (id: string) => books.filter((b) => b.author_id === id),
  activities: () => activities,
  activityBySlug: (slug: string) => activities.find((a) => a.slug === slug) ?? null,
  events: () => events,
  eventBySlug: (slug: string) => events.find((e) => e.slug === slug) ?? null,
  page: (slug: string) => pages[slug] ?? null,
  settings: () => settings,
};
