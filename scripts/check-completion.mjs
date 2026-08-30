/**
 * בדיקת מד ההשלמה של הספר.
 *
 * הרצה: node --experimental-strip-types scripts/check-completion.mjs
 *
 * [1.11] המד מכסה כעת את כל הלשוניות בכרטיס הספר (לא רק פרטי יסוד
 * ואנגלית), עם ניקוד משוקלל כולל חצאי נקודות — הבדיקות כאן מקבעות את
 * העקרונות: כריכה בלי alt נספרת כחסרה, פרסום אינו משפיע, פריטי מסחר
 * נבדקים רק לספר רכישה, ולכל פריט משויכת לשונית.
 */
import { computeCompletion } from '../src/lib/completion.ts';

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) {
    failures += 1;
    console.log(`    התקבל: ${JSON.stringify(actual)}`);
    console.log(`    צפוי:  ${JSON.stringify(expected)}`);
  }
}

const emptySignals = { tagIds: [], categoryIds: [], attributeValueIds: [] };

const book = (over = {}) => ({
  id: 'b1', slug: 'x', title_he: 'ספר', title_en: null,
  subtitle_he: null, subtitle_en: null,
  description_he: null, description_en: null,
  description_brief_he: null, description_brief_en: null,
  author_id: null, author_name_he: null, author_name_en: null, category_id: null,
  series_id: null,
  publication_year_he: null, publication_year_ce: null,
  cover_image_url: null, spine_image_url: null, hero_mockup_url: null,
  pages: null, format: null, binding: null, isbn: null,
  volume_count: 1, sample_pdf_url: null,
  publisher_he: null, publisher_en: null, edition_he: null, edition_en: null,
  accent_primary: null, accent_secondary: null,
  quotes: [],
  price: null, currency: 'ILS', sku: null, stock_quantity: 0,
  is_purchasable: false, is_stock_managed: true, preorder_enabled: false,
  weight_grams: null, physical_size: null, barcode: null,
  is_published: false, sort_order: 0,
  languages: ['he'], cover_alt: null, meta_title: null, meta_description: null,
  og_image_url: null, canonical_url: null, search_keywords: null,
  created_at: '', updated_at: '',
  ...over,
});

/* --- ספר ריק לגמרי (רק שם, שפות וברירת מחדל) --- */
// cover_alt נספר כמולא כשאין כריכה בכלל (ראו הבדיקה בהמשך) —
// בלי כריכה, "אין טקסט חלופי" אינו ליקוי אלא מצב שאין בו מה לתאר.
// הערכים עודכנו אחרי הסרת שדה "פורמט" ממודל ההשלמה (מבנה הטופס מחדש):
// 13 = ‎(10 שם + 1 שפות + 2 פטור alt) / 103.5 נק' אפשריות, מעוגל.
const empty = computeCompletion(book(), emptySignals);
check('ספר ריק: 13% (שם + שפות + פטור alt מתוך 103.5 נק\')', empty.percent, 13);
check('ספר ריק: 35 חסרים', empty.missing.length, 35);
check(
  'כריכה חסרה אינה דורשת גם alt — לא כפילות',
  empty.missing.some((i) => i.key === 'cover_alt'),
  false,
);

/* --- כל פריט משויך ללשונית בטופס --- */
check(
  'לכל פריט יש לשונית',
  empty.items.every((i) => typeof i.tab === 'string' && i.tab.length > 0),
  true,
);

/* --- חצאי נקודות: גוני האווירה שוקלים חצי נקודה כל אחד --- */
const accents = empty.items.filter((i) => i.key.startsWith('accent_'));
check('שני פריטי גוון אווירה', accents.length, 2);
check('משקל חצי נקודה לגוון', accents.every((i) => i.weight === 0.5), true);

/* --- ספר מלא לגמרי --- */
const full = computeCompletion(
  book({
    cover_image_url: '/c.jpg', cover_alt: 'כריכה', spine_image_url: '/sp.jpg',
    hero_mockup_url: '/h.png', sample_pdf_url: '/s.pdf',
    author_id: 'a1', author_name_en: 'Author', category_id: 'c1',
    subtitle_he: 'משנה', subtitle_en: 'Sub', description_he: '<p>תוכן</p>',
    description_en: '<p>Body</p>', description_brief_he: 'תמצית', description_brief_en: 'Brief',
    title_en: 'Book', publication_year_he: 'תשפ״ו', publication_year_ce: 2026,
    publisher_he: 'הוצאה', publisher_en: 'Press', edition_he: 'שנייה', edition_en: '2nd',
    pages: 320, isbn: '978', sku: 'BK-1', format: '17x24', binding: 'קשה',
    accent_primary: '#123456', accent_secondary: '#654321',
    quotes: ['ציטוט'], meta_title: 'כותרת', meta_description: 'תיאור',
    search_keywords: 'מילים',
  }),
  {
    tagIds: ['t1'], categoryIds: ['c2'], attributeValueIds: ['v1'],
    galleryCount: 3, tocCount: 5, previewCount: 4,
  },
);
check('ספר מלא: 100 אחוז', full.percent, 100);
check('ספר מלא: אין חסרים', full.missing.length, 0);

/* --- כריכה בלי alt: זה כן חסר --- */
const noAlt = computeCompletion(book({ cover_image_url: '/c.jpg' }), emptySignals);
check(
  'יש כריכה בלי alt — כן נספר כחסר',
  noAlt.missing.some((i) => i.key === 'cover_alt'),
  true,
);

/* --- פריטי מסחר רק לספר רכישה --- */
const catalogueOnly = computeCompletion(book(), emptySignals);
check(
  'ספר קטלוג: אין פריטי מסחר',
  catalogueOnly.items.some((i) => i.tab === 'store'),
  false,
);
const purchasable = computeCompletion(book({ is_purchasable: true }), emptySignals);
check(
  'ספר רכישה: יש פריטי מסחר (מחיר, מלאי, משקל, מידות, ברקוד)',
  purchasable.items.filter((i) => i.tab === 'store').map((i) => i.key),
  ['price', 'stock', 'weight', 'physical_size', 'barcode'],
);

/* --- אותות מטבלאות-בת: גלריה/תוכן עניינים/דפדוף נספרים כשסופקו --- */
const withChildRows = computeCompletion(book(), {
  ...emptySignals,
  galleryCount: 2, tocCount: 3, previewCount: 1,
});
check(
  'גלריה+תוכן עניינים+דפדוף הושלמו כשיש שורות',
  ['gallery', 'toc', 'preview_pages'].every(
    (key) => withChildRows.items.find((i) => i.key === key)?.done,
  ),
  true,
);

/* --- is_published אינו חלק מהחישוב --- */
const publishedButEmpty = computeCompletion(book({ is_published: true }), emptySignals);
check('פרסום אינו משפיע על האחוז', publishedButEmpty.percent, empty.percent);

console.log(failures === 0 ? '\nמד ההשלמה תקין.' : `\n${failures} בדיקות נכשלו.`);
process.exit(failures === 0 ? 0 : 1);
