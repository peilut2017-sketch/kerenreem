import type {
  Activity,
  Banner,
  Author,
  BookWithRelations,
  Category,
  ContentPage,
  EventBlock,
  EventRecord,
  Series,
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
    id: 'a1', catalogue_number: 1, slug: 'raam-hacohen', name_he: 'הרב רא״ם הכהן', name_en: null,
    bio_he: '<p>מחבר ועורך, מן הכותבים המרכזיים שהמכון מוציא לאור.</p>', bio_en: null,
    portrait_url: null, birth_year: 'תש״ח', death_year: null, timeline: [],
    sort_order: 10, is_published: true, ...base,
  },
  {
    id: 'a2', catalogue_number: 2, slug: 'avraham-kook', name_he: 'הרב אברהם קוק', name_en: null,
    // ביוגרפיה בת כמה פסקאות בכוונה: היא מה שמפעיל את הקיצור וההרחבה
    // באזור המחבר שבעמוד הספר (ראו AuthorBio), ובלעדיה אי אפשר לבדוק אותו.
    bio_he:
      '<p>מגדולי הפוסקים והוגי הדעות של הדורות האחרונים. נולד בגריבה שבלטביה, ' +
      'למד בישיבת וולוז׳ין, וכיהן ברבנות בכמה קהילות באירופה טרם עלייתו לארץ.</p>' +
      '<p>בשנת תרנ״ד עלה לארץ ישראל וכיהן כרבה של יפו והמושבות. בתקופה זו החל ' +
      'לגבש את משנתו הרחבה, שעסקה ביחס שבין תורה לחיי המעשה, ובמקומה של ' +
      'ההלכה בחיי ציבור מתחדשים.</p>' +
      '<p>בשנת תרפ״א נתמנה לרב הראשי האשכנזי הראשון לארץ ישראל. בשנים אלו ' +
      'הרבה לכתוב תשובות בהלכה, וכן חיבורים בענייני אמונה ומחשבה, שרבים מהם ' +
      'ראו אור רק לאחר פטירתו.</p>' +
      '<p>מכתביו ההדיר המכון כמה מהדורות, ובהן מהדורות מוערות שיצאו בשנים ' +
      'האחרונות בליווי מפתחות וביאורים.</p>',
    bio_en: null,
    portrait_url: null, birth_year: 'תרכ״ה', death_year: 'תרצ״ה',
    timeline: [
      { year: 'תרכ״ה', text: 'נולד בגריבה, לטביה' },
      { year: 'תרנ״ד', text: 'עלה לארץ ישראל' },
      { year: 'תרפ״א', text: 'נתמנה לרב הראשי האשכנזי לארץ ישראל' },
      { year: 'תרצ״ה', text: 'נסתלק בירושלים' },
    ],
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
    id, catalogue_number: Number(id.replace(/\D/g, '')) || 0, slug, title_he: title, title_en: null,
    subtitle_he: subtitle, subtitle_en: null,
    description_he: `<p>${subtitle ?? title} — מהדורה מוערת בהוצאת המכון.</p>`,
    description_en: null,
    description_brief_he: null,
    description_brief_en: null,
    author_id: author.id, author_name_he: null, author_name_en: null, category_id: category.id,
    publication_year_he: yearHe, publication_year_ce: yearCe,
    cover_image_url: `/demo/cover-${cover}.svg`,
    spine_image_url: null,
    pages: 412, format: 'פוליו', binding: 'כריכה קשה', isbn: null,
    volume_count: 1, sample_pdf_url: null,
    price: null, currency: 'ILS', sku: null, stock_quantity: 0,
    is_purchasable: false, weight_grams: null, stock_location: null, physical_size: null,
    sale_price: null, sale_starts_at: null, sale_ends_at: null,
    sale_name_he: null, sale_name_en: null, compare_at_price: null,
    tax_group: 'standard', is_stock_managed: true, low_stock_threshold: null,
    allow_backorder: false, barcode: null, prep_days_override: null,
    free_shipping_eligible: true, coupons_excluded: false,
    languages: ['he'], cover_alt: null,
    meta_title: null, meta_description: null, og_image_url: null,
    canonical_url: null, search_keywords: null,
    is_published: true, sort_order: 0,
    series_id: null, series_position: null, quotes: [], view_count: 0,
    publisher_he: null, publisher_en: null, edition_he: null, edition_en: null,
    accent_primary: null, accent_secondary: null,
    is_featured: false, preorder_enabled: false, preorder_release_date: null,
    hero_mockup_url: null,
    external_supplier_enabled: false, external_supplier_url: null,
    external_supplier_name: null, external_supplier_always_show: false,
    ...base,
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

/**
 * העשרת שלב ג׳ לדוגמאות בודדות בלבד — כדי שרכיבי התצוגה (גלריה, תוכן
 * עניינים, סדרה, ציטוטים) יהיו ניתנים לבדיקה חזותית בלי מסד אמיתי.
 * שני הספרים שנבחרו הם כבר מאותו מחבר (a2) בנתוני הדוגמה הקיימים.
 */
const demoSeries: Series = {
  id: 's1', slug: 'mishkan-avraham', name_he: 'סדרת משכן אברהם', name_en: null,
  description_he: '<p>מהדורה מוערת בשני כרכים.</p>', ...base,
};

books[2] = {
  ...books[2],
  series_id: demoSeries.id,
  series_position: 1,
  series: demoSeries,
  description_brief_he: 'שני כרכים על יסודות ההנהגה בציבור, מוגהים מכתבי היד ומלווים בביאורים ומפתחות.',
  quotes: [
    'כל המצר לישראל נעשה פרנס על הציבור — כך למדנו מכאן שהצער הוא עצמו הכשרה להנהגה.',
    'אין השראת השכינה שורה אלא מתוך שמחה של מצווה.',
  ],
  images: [
    {
      id: 'im1', book_id: books[2].id, image_url: '/demo/scene-beit-midrash.svg',
      alt: 'פתיחת השער', caption_he: 'פתיחת השער', sort_order: 0,
    },
    {
      id: 'im2', book_id: books[2].id, image_url: '/demo/scene-siyum-hashas.svg',
      alt: 'עמוד לדוגמה', caption_he: 'עמוד לדוגמה מתוך הפרק הראשון', sort_order: 1,
    },
  ],
  toc: [
    { id: 't1', book_id: books[2].id, title_he: 'מבוא', level: 0, page_number: 1, summary_he: 'רקע כללי ומטרת החיבור.', sort_order: 0 },
    { id: 't2', book_id: books[2].id, title_he: 'פרק א: יסודות', level: 0, page_number: 12, summary_he: null, sort_order: 1 },
    { id: 't3', book_id: books[2].id, title_he: 'סימן א', level: 1, page_number: 12, summary_he: null, sort_order: 2 },
    { id: 't4', book_id: books[2].id, title_he: 'פרק ב: הרחבות', level: 0, page_number: 45, summary_he: null, sort_order: 3 },
    { id: 't5', book_id: books[2].id, title_he: 'נספחים', level: 0, page_number: 88, summary_he: null, sort_order: 4 },
  ],
  view_count: 214,
  // דפי דוגמה מומרים — בדמו הם SVG סטטיים, במסד הם WebP שהופקו בניהול.
  // קיימים כאן כדי שאפשר יהיה לבדוק את הדפדוף (וכיוון ה-RTL שלו) בלי מסד.
  previewPages: [1, 2, 3, 4, 5, 6].map((pageNumber) => ({
    id: `pp${pageNumber}`,
    book_id: books[2].id,
    page_number: pageNumber,
    image_url: `/demo/page-${pageNumber}.svg`,
    width: 700,
    height: 900,
    created_at: base.created_at,
  })),
};
books[4] = { ...books[4], series_id: demoSeries.id, series_position: 2, series: demoSeries, view_count: 96 };

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/** דוגמת רצף סיפור, לתצוגת "עמוד אירוע" ברצף אחד ולא כל הטקסט ואז כל הגלריה. */
const siyumBlocks: EventBlock[] = [
  {
    id: 'b1', event_id: 'e2', type: 'text', sort_order: 0, stage_label: 'קבלת פנים',
    body_he: 'מאות תלמידי חכמים ובני משפחותיהם התכנסו כבר משעות הצהריים באולם המרכזי, לקראת מעמד הסיום.',
    body_en: null, image_url: null, image_alt: null, image_caption_he: null, images: [],
    video_url: null, video_caption_he: null, quote_text: null, quote_attribution_he: null,
  },
  {
    id: 'b2', event_id: 'e2', type: 'image', sort_order: 1, stage_label: null,
    body_he: null, body_en: null,
    image_url: '/demo/scene-beit-midrash.svg', image_alt: 'אולם בית המדרש לפני תחילת המעמד',
    image_caption_he: 'האולם המרכזי, דקות לפני תחילת המעמד', images: [],
    video_url: null, video_caption_he: null, quote_text: null, quote_attribution_he: null,
  },
  {
    id: 'b3', event_id: 'e2', type: 'text', sort_order: 2, stage_label: 'דברי פתיחה',
    body_he: 'ראש הכולל פתח בדברי ברכה, והזכיר את מסכת השנה שחלפה ואת ההכנות למחזור הלימוד הבא.',
    body_en: null, image_url: null, image_alt: null, image_caption_he: null, images: [],
    video_url: null, video_caption_he: null, quote_text: null, quote_attribution_he: null,
  },
  {
    id: 'b4', event_id: 'e2', type: 'image_row', sort_order: 3, stage_label: 'השיעור',
    body_he: null, body_en: null, image_url: null, image_alt: null, image_caption_he: null,
    images: [
      { url: '/demo/scene-kenes-achdut.svg', alt: 'רבנים על הבמה', caption_he: null },
      { url: '/demo/scene-slichot.svg', alt: 'הקהל מאזין', caption_he: null },
      { url: '/demo/scene-siyum-hashas.svg', alt: 'רגע הסיום', caption_he: null },
    ],
    video_url: null, video_caption_he: null, quote_text: null, quote_attribution_he: null,
  },
  {
    id: 'b5', event_id: 'e2', type: 'quote', sort_order: 4, stage_label: null,
    body_he: null, body_en: null, image_url: null, image_alt: null, image_caption_he: null, images: [],
    video_url: null, video_caption_he: null,
    quote_text: 'זכינו לסיים ולפתוח, והתורה מוסיפה והולכת מדור לדור.',
    quote_attribution_he: 'ראש הכולל, מדברי הפתיחה',
  },
  {
    id: 'b6', event_id: 'e2', type: 'text', sort_order: 5, stage_label: 'חלוקת הספרים',
    body_he: 'בסיום המעמד חולקו לכל אחד מהלומדים כרך חדש ממהדורת המכון, כסימן להתחלת המחזור הבא.',
    body_en: null, image_url: null, image_alt: null, image_caption_he: null, images: [],
    video_url: null, video_caption_he: null, quote_text: null, quote_attribution_he: null,
  },
  {
    id: 'b7', event_id: 'e2', type: 'video', sort_order: 6, stage_label: 'סיום',
    body_he: null, body_en: null, image_url: null, image_alt: null, image_caption_he: null, images: [],
    video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', video_caption_he: 'סיכום המעמד בווידאו',
    quote_text: null, quote_attribution_he: null,
  },
];

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
    featured_video_url: null,
    gallery: [
      { url: '/demo/scene-beit-midrash.svg', caption_he: 'מבט מהיציע' },
      { url: '/demo/scene-kenes-achdut.svg' },
      { url: '/demo/scene-slichot.svg', caption_he: 'לפני תחילת המעמד' },
      { url: '/demo/cover-mishkan-even.svg' },
      { url: '/demo/cover-or-hahalacha.svg' },
    ],
    is_published: true, ...base,
    blocks: siyumBlocks,
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
  logo_dark_url: null,
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
  connections: (book: BookWithRelations) => {
    const tagIds = new Set((book.tags ?? []).map((tag) => tag.id));
    return {
      manual: [],
      sameAuthor: books.filter((b) => b.id !== book.id && b.author_id === book.author_id),
      sameSeries: books.filter((b) => b.id !== book.id && book.series_id && b.series_id === book.series_id),
      sameCategory: books.filter((b) => b.id !== book.id && b.category_id === book.category_id),
      sameTags: books.filter((b) => b.id !== book.id && (b.tags ?? []).some((tag) => tagIds.has(tag.id))),
    };
  },
  activities: () => activities,
  activityBySlug: (slug: string) => activities.find((a) => a.slug === slug) ?? null,
  events: () => events,
  eventBySlug: (slug: string) => events.find((e) => e.slug === slug) ?? null,
  page: (slug: string) => pages[slug] ?? null,
  settings: () => settings,
};
