/**
 * בדיקת מד ההשלמה של הספר.
 *
 * הרצה: node --experimental-strip-types scripts/check-completion.mjs
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

const emptyRelations = { tagIds: [], categoryIds: [], attributeValueIds: [] };

const book = (over = {}) => ({
  id: 'b1', slug: 'x', title_he: 'ספר', title_en: null,
  subtitle_he: null, subtitle_en: null,
  description_he: null, description_en: null,
  author_id: null, category_id: null,
  publication_year_he: null, publication_year_ce: null,
  cover_image_url: null, pages: null, format: null, binding: null, isbn: null,
  volume_count: 1, sample_pdf_url: null,
  price: null, currency: 'ILS', sku: null, stock_quantity: 0,
  is_purchasable: false, weight_grams: null,
  is_published: false, sort_order: 0,
  languages: [], cover_alt: null, meta_title: null, meta_description: null,
  og_image_url: null, canonical_url: null, search_keywords: null,
  created_at: '', updated_at: '',
  ...over,
});

/* --- ספר ריק לגמרי --- */
// 7 חסרים ולא 8: cover_alt נספר כמולא כשאין כריכה בכלל (ראו הבדיקה הבאה) —
// בלי כריכה, "אין טקסט חלופי" אינו ליקוי אלא מצב שאין בו מה לתאר.
const empty = computeCompletion(book(), emptyRelations);
check('ספר ריק: 7 מתוך 8 חסרים (13%)', empty.percent, 13);
check('ספר ריק: 7 חסרים', empty.missing.length, 7);
check(
  'כריכה חסרה אינה דורשת גם alt — לא כפילות',
  empty.missing.some((i) => i.key === 'cover_alt'),
  false,
);

/* --- ספר מלא לגמרי --- */
const full = computeCompletion(
  book({
    cover_image_url: '/c.jpg', cover_alt: 'כריכה', author_id: 'a1', category_id: 'c1',
    description_he: '<p>תוכן</p>', meta_description: 'תיאור', sample_pdf_url: '/s.pdf',
  }),
  { tagIds: ['t1'], categoryIds: [], attributeValueIds: [] },
);
check('ספר מלא: 100 אחוז', full.percent, 100);
check('ספר מלא: אין חסרים', full.missing.length, 0);

/* --- כריכה בלי alt: זה כן חסר --- */
const noAlt = computeCompletion(book({ cover_image_url: '/c.jpg' }), emptyRelations);
check(
  'יש כריכה בלי alt — כן נספר כחסר',
  noAlt.missing.some((i) => i.key === 'cover_alt'),
  true,
);

/* --- meta_title לבדו מספיק ל-SEO, בלי meta_description --- */
const titleOnly = computeCompletion(book({ meta_title: 'כותרת' }), emptyRelations);
check(
  'meta_title לבד מסמן SEO כמושלם',
  titleOnly.items.find((i) => i.key === 'seo').done,
  true,
);

/* --- is_published אינו חלק מהחישוב --- */
const publishedButEmpty = computeCompletion(book({ is_published: true }), emptyRelations);
check('פרסום אינו משפיע על האחוז', publishedButEmpty.percent, empty.percent);

console.log(failures === 0 ? '\nמד ההשלמה תקין.' : `\n${failures} בדיקות נכשלו.`);
process.exit(failures === 0 ? 0 : 1);
