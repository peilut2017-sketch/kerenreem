/**
 * בדיקת מנוע החיפוש של הקטלוג.
 *
 * הנרמול העברי הוא החלק שנשבר בשקט: חיפוש שלא מוצא ספר קיים נראה למשתמש
 * כמו קטלוג חסר, לא כמו תקלה. הבדיקות כאן מכסות את שלוש הצורות שבהן אותו
 * שם נכתב בפועל — עם ניקוד, עם גרשיים עבריות, ועם מרכאה רגילה.
 *
 * הרצה: node --experimental-strip-types scripts/check-book-search.mjs
 */
import {
  normalise,
  matches,
  searchCorpus,
  applyFilters,
  sortBooks,
  EMPTY_FILTERS,
} from '../src/lib/book-search.ts';

let failures = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) {
    failures += 1;
    console.log(`    התקבל:  ${JSON.stringify(actual)}`);
    console.log(`    צפוי:   ${JSON.stringify(expected)}`);
  }
}

/* --- נרמול --- */
check('ניקוד מוסר', normalise('שַׁבָּת'), 'שבת');
check('טעמי מקרא מוסרים', normalise('בְּרֵאשִׁ֖ית'), 'בראשית');
check('גרשיים עבריות ומרכאה רגילה מתלכדות', normalise('שו״ת') === normalise('שו"ת'), true);
check('גרש עברי וגרש רגיל מתלכדים', normalise('רא״ם') === normalise('רא"ם'), true);
check('מקף הופך לרווח', normalise('בן-איש'), 'בן איש');
check('רווחים כפולים מתכווצים', normalise('  שני   רווחים '), 'שני רווחים');

/* --- התאמה --- */
const corpus = normalise('שו״ת רא״ם על הלכות שבת מאת הרב יצחק');
check('מציאה למרות הבדל בסוג הגרשיים', matches(corpus, 'שו"ת'), true);
check('מילים בסדר הפוך', matches(corpus, 'רא"ם שו"ת'), true);
check('כל המילים חייבות להימצא', matches(corpus, 'שו"ת פסח'), false);
check('חיפוש ריק מחזיר הכל', matches(corpus, '   '), true);
check('חיפוש עם ניקוד מוצא טקסט בלי ניקוד', matches(corpus, 'שַׁבָּת'), true);

/* --- מאגר החיפוש --- */
const book = (over = {}) => ({
  id: over.id ?? 'a',
  slug: 'x',
  title_he: 'ספר הבדיקה',
  title_en: null,
  subtitle_he: null,
  subtitle_en: null,
  description_he: '<p>העוסק ב<strong>גרמא</strong> בשבת</p>',
  description_en: null,
  author: { name_he: 'הרב לוי', slug: 'levi' },
  category: { name_he: 'הלכה', slug: 'halacha' },
  isbn: '978-1',
  sku: null,
  publication_year_he: 'תשפ״ד',
  publication_year_ce: 2024,
  format: null,
  binding: 'קשה',
  volume_count: 1,
  sample_pdf_url: null,
  tags: over.tags ?? [],
  attributeValues: over.attributeValues ?? [],
  languages: over.languages ?? [],
  search_keywords: null,
  is_purchasable: false,
  price: null,
  sort_order: 0,
  created_at: '2024-01-01',
  ...over,
});

const c = searchCorpus(book());
check('התיאור נכנס לחיפוש בלי תגיות HTML', matches(c, 'גרמא'), true);
check('שם התגית עצמה אינה נמצאת', c.includes('strong'), false);
check('שם המחבר נמצא', matches(c, 'לוי'), true);
check('שם הקטגוריה נמצא', matches(c, 'הלכה'), true);
check('מסת״ב נמצא', matches(c, '978-1'), true);
check('שנה עברית נמצאת', matches(c, 'תשפ"ד'), true);
check('שנה לועזית נמצאת', matches(c, '2024'), true);

/* --- סינון --- */
const books = [
  book({ id: '1', title_he: 'אלף', binding: 'קשה', publication_year_ce: 2000, volume_count: 3 }),
  book({ id: '2', title_he: 'בית', binding: 'רכה', publication_year_ce: 2020, volume_count: 1,
         sample_pdf_url: '/x.pdf', is_purchasable: true, price: 80 }),
  book({ id: '3', title_he: 'גימל', binding: 'קשה', publication_year_ce: 2024, volume_count: 1 }),
];
const corpora = new Map(books.map((b) => [b.id, searchCorpus(b)]));
const ids = (list) => list.map((b) => b.id);

check('סינון לפי כריכה', ids(applyFilters(books, { ...EMPTY_FILTERS, bindings: ['קשה'] }, corpora, new Set())), ['1', '3']);
check('סינון לפי טווח שנים', ids(applyFilters(books, { ...EMPTY_FILTERS, yearFrom: 2010, yearTo: 2030 }, corpora, new Set())), ['2', '3']);
check('סינון לפי ריבוי כרכים', ids(applyFilters(books, { ...EMPTY_FILTERS, multiVolume: true }, corpora, new Set())), ['1']);
check('סינון לפי קובץ לדוגמה', ids(applyFilters(books, { ...EMPTY_FILTERS, withSample: true }, corpora, new Set())), ['2']);
check('סינון לפי מועדפים', ids(applyFilters(books, { ...EMPTY_FILTERS, favouritesOnly: true }, corpora, new Set(['3']))), ['3']);
check('סינון לפי מחיר מרבי', ids(applyFilters(books, { ...EMPTY_FILTERS, priceMax: 100 }, corpora, new Set())), ['2']);

/* --- תגיות, מאפיינים ושפות --- */
const tagged = [
  book({ id: 'A', tags: [{ id:'t1', slug:'shabbat', name_he:'שבת' }, { id:'t2', slug:'halacha', name_he:'הלכה' }],
         attributeValues: [{ id:'v-hard', attribute_id:'binding', name_he:'קשה' }], languages: ['he'] }),
  book({ id: 'B', tags: [{ id:'t1', slug:'shabbat', name_he:'שבת' }],
         attributeValues: [{ id:'v-soft', attribute_id:'binding', name_he:'רכה' },
                           { id:'v-kids', attribute_id:'audience', name_he:'ילדים' }], languages: ['he','en'] }),
  book({ id: 'C', tags: [], attributeValues: [], languages: ['yi'] }),
];
const tCorpora = new Map(tagged.map((b) => [b.id, searchCorpus(b)]));
const attributeOf = new Map([['v-hard','binding'], ['v-soft','binding'], ['v-kids','audience']]);
const run = (f) => ids(applyFilters(tagged, { ...EMPTY_FILTERS, ...f }, tCorpora, new Set(), attributeOf));

check('תגית אחת', run({ tags: ['shabbat'] }), ['A', 'B']);
check('שתי תגיות הן חיתוך ולא איחוד', run({ tags: ['shabbat', 'halacha'] }), ['A']);
check('שם התגית נכנס לחיפוש החופשי', matches(tCorpora.get('A'), 'הלכה'), true);
check('שם המאפיין נכנס לחיפוש החופשי', matches(tCorpora.get('B'), 'ילדים'), true);
check('ערך מאפיין יחיד', run({ attributeValues: ['v-hard'] }), ['A']);
check(
  'שני ערכים של אותו מאפיין הם איחוד',
  run({ attributeValues: ['v-hard', 'v-soft'] }),
  ['A', 'B'],
);
check(
  'ערכים ממאפיינים שונים הם חיתוך',
  run({ attributeValues: ['v-hard', 'v-kids'] }),
  [],
);
check('שפה', run({ languages: ['en'] }), ['B']);
check('שפה שאין לאיש', run({ languages: ['fr'] }), []);

/* --- מיון --- */
check('מיון א׳-ת׳ לפי סדר האלף-בית', ids(sortBooks(books, 'title')), ['1', '2', '3']);
check(
  'ספר בלי מחיר יורד לסוף במיון מחיר',
  ids(sortBooks(books, 'priceAsc'))[0],
  '2',
);

console.log(failures === 0 ? '\nמנוע החיפוש תקין.' : `\n${failures} בדיקות נכשלו.`);
process.exit(failures === 0 ? 0 : 1);
