/**
 * ‏[1.42] בדיקות סורק הגבולות — המנגנון שהחליף את ה-ISR מבוסס-הזמן.
 *
 * הרצה: node --experimental-strip-types scripts/check-boundaries.mjs
 *
 * למה זה חייב בדיקות: אחרי הסרת ה-revalidate מעמודי המסחר, זה **הדבר
 * היחיד** שגורם למבצע להתחיל, לבאנר להיעלם ולאירוע לעבור ל"היה". כשל
 * שקט כאן פירושו מבצע שהוגדר ולא התחיל — ואף אחד לא יבחין עד שלקוח
 * יתלונן שהמחיר לא נכון.
 *
 * ‏buildBoundaryPaths היא פונקציה טהורה, ולכן רוב הבדיקות אינן זקוקות
 * למסד בכלל. הסמן עצמו נבדק מול transport מוחלף.
 */
import { register } from 'node:module';

register(new URL('./resolve-server-only.mjs', import.meta.url));

const {
  buildBoundaryPaths,
  OVERFLOW_THRESHOLD,
  CURSOR_KEY,
  DEFAULT_LOOKBACK_MS,
} = await import('../src/lib/revalidation/boundaries.ts');

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  if (!ok) {
    console.log(`      התקבל: ${JSON.stringify(actual)}`);
    console.log(`      צפוי:  ${JSON.stringify(expected)}`);
  }
}

const T0 = Date.parse('2026-09-25T12:00:00Z');
const T1 = Date.parse('2026-09-25T12:15:00Z');
const INSIDE = '2026-09-25T12:07:00Z';
const BEFORE = '2026-09-25T11:00:00Z';
const AFTER = '2026-09-25T13:00:00Z';

/** ממוין, כדי שהשוואות לא יישברו על סדר הוספה. */
function scan({ books = [], banners = [], events = [], from = T0, to = T1 } = {}) {
  const result = buildBoundaryPaths({ from, to, books, banners, events });
  return { paths: [...result.paths].sort(), counts: result.counts, overflow: result.overflow };
}

const book = (overrides) => ({
  slug: 'sefer',
  authorSlug: null,
  saleStartsAt: null,
  saleEndsAt: null,
  ...overrides,
});

console.log('אין גבול → אפס רענון\n');

check('הכול ריק', scan(), { paths: [], counts: { books: 0, banners: 0, events: 0 }, overflow: false });

check(
  'מבצע שהתחיל לפני החלון — לא נחצה בו',
  scan({ books: [book({ saleStartsAt: BEFORE })] }),
  { paths: [], counts: { books: 0, banners: 0, events: 0 }, overflow: false },
);

check(
  'מבצע שיתחיל אחרי החלון — לא נחצה בו',
  scan({ books: [book({ saleStartsAt: AFTER })] }),
  { paths: [], counts: { books: 0, banners: 0, events: 0 }, overflow: false },
);

check(
  'ספר בלי תאריכי מבצע בכלל',
  scan({ books: [book({})] }),
  { paths: [], counts: { books: 0, banners: 0, events: 0 }, overflow: false },
);

console.log('\nגבול תחתון וגבול עליון של החלון [T0, T1)');

check(
  'גבול בדיוק ב-T0 → נכלל',
  scan({ books: [book({ saleStartsAt: new Date(T0).toISOString() })] }).counts.books,
  1,
);
check(
  'גבול בדיוק ב-T1 → אינו נכלל (חצי-פתוח, ייכנס לחלון הבא)',
  scan({ books: [book({ saleStartsAt: new Date(T1).toISOString() })] }).counts.books,
  0,
);

console.log('\nמבצע — נתיבים בשתי השפות');

check('מבצע נפתח, ספר בלי מחבר משויך', scan({ books: [book({ saleStartsAt: INSIDE })] }), {
  paths: ['/', '/books', '/books/sefer', '/en', '/en/books', '/en/books/sefer'],
  counts: { books: 1, banners: 0, events: 0 },
  overflow: false,
});

check(
  'מבצע נסגר — אותם נתיבים בדיוק',
  scan({ books: [book({ saleEndsAt: INSIDE })] }).paths,
  ['/', '/books', '/books/sefer', '/en', '/en/books', '/en/books/sefer'],
);

check(
  'ספר עם מחבר משויך → גם עמודי המחבר',
  scan({ books: [book({ saleStartsAt: INSIDE, authorSlug: 'raam' })] }).paths,
  [
    '/',
    '/authors/raam',
    '/books',
    '/books/sefer',
    '/en',
    '/en/authors/raam',
    '/en/books',
    '/en/books/sefer',
  ],
);

console.log('\nקיבוץ (dedupe)');

const three = scan({
  books: [
    book({ slug: 'a', saleStartsAt: INSIDE, authorSlug: 'raam' }),
    book({ slug: 'b', saleEndsAt: INSIDE, authorSlug: 'raam' }),
    book({ slug: 'c', saleStartsAt: INSIDE, authorSlug: 'other' }),
  ],
});
check('שלושה ספרים → /books, / ועמוד מחבר משותף פעם אחת בלבד', three.paths, [
  '/',
  '/authors/other',
  '/authors/raam',
  '/books',
  '/books/a',
  '/books/b',
  '/books/c',
  '/en',
  '/en/authors/other',
  '/en/authors/raam',
  '/en/books',
  '/en/books/a',
  '/en/books/b',
  '/en/books/c',
]);
check('שלושה ספרים נספרו', three.counts.books, 3);
check('אין כפילויות בכלל', three.paths.length, new Set(three.paths).size);

console.log('\nבאנר — עמוד הבית בלבד');

check('באנר נפתח', scan({ banners: [{ starts_at: INSIDE, ends_at: null }] }), {
  paths: ['/', '/en'],
  counts: { books: 0, banners: 1, events: 0 },
  overflow: false,
});

check(
  'באנר נסגר (חותמת מלאה)',
  scan({ banners: [{ starts_at: null, ends_at: INSIDE }] }).paths,
  ['/', '/en'],
);

/*
 * תאריך-בלבד נמתח עד סוף אותו יום (ראו lib/banner-window.ts) — כלומר
 * באנר שמסתיים ב-24.9 נעלם בחצות שבין 24 ל-25, ולא בחצות שבתחילת 24.
 */
check(
  'באנר עם תאריך-בלבד נסגר בסוף אותו יום',
  scan({
    banners: [{ starts_at: null, ends_at: '2026-09-24' }],
    from: Date.parse('2026-09-24T23:50:00Z'),
    to: Date.parse('2026-09-25T00:05:00Z'),
  }).paths,
  ['/', '/en'],
);
check(
  'אותו באנר אינו נחצה בחצות שבתחילת 24.9',
  scan({
    banners: [{ starts_at: null, ends_at: '2026-09-24' }],
    from: Date.parse('2026-09-23T23:50:00Z'),
    to: Date.parse('2026-09-24T00:05:00Z'),
  }).paths,
  [],
);

console.log('\nאירוע שעובר ל"היה" — רשימת האירועים בלבד');

/*
 * ‏isUpcoming בודק date >= startOfDay(now), ולכן אירוע ביום D מפסיק
 * להיות קרוב בחצות שבין D ל-D+1. השעות מקומיות, כמו בפונקציה עצמה.
 */
const midnightCross = {
  from: new Date('2026-09-25T23:55:00').getTime(),
  to: new Date('2026-09-26T00:05:00').getTime(),
};
check('אירוע של 25.9 עובר בחצות שאחריו', scan({ events: [{ eventDate: '2026-09-25' }], ...midnightCross }), {
  paths: ['/en/events', '/events'],
  counts: { books: 0, banners: 0, events: 1 },
  overflow: false,
});
check(
  'אירוע של מחר אינו עובר באותה חצות',
  scan({ events: [{ eventDate: '2026-09-26' }], ...midnightCross }).paths,
  [],
);
check(
  'אירוע של שבוע שעבר אינו עובר שוב',
  scan({ events: [{ eventDate: '2026-09-18' }], ...midnightCross }).paths,
  [],
);
check('אירוע בלי תאריך נדלג בשקט', scan({ events: [{ eventDate: null }] }).paths, []);

console.log('\nהשבתה ארוכה — כל הגבולות שלא עובדו חוזרים');

const outage = scan({
  from: Date.parse('2026-09-24T12:00:00Z'),
  to: Date.parse('2026-09-25T12:00:00Z'),
  books: [
    book({ slug: 'a', saleStartsAt: '2026-09-24T13:00:00Z' }),
    book({ slug: 'b', saleEndsAt: '2026-09-25T06:00:00Z' }),
    book({ slug: 'c', saleStartsAt: '2026-09-26T06:00:00Z' }), // עתידי — לא
  ],
  banners: [{ starts_at: '2026-09-24T20:00:00Z', ends_at: null }],
});
check('חלון של 24 שעות מחזיר את שני הספרים שנחצו, לא את העתידי', outage.counts, {
  books: 2,
  banners: 1,
  events: 0,
});
check('הנתיבים כוללים את שני הספרים', outage.paths.includes('/books/a') && outage.paths.includes('/books/b'), true);
check('ולא את הספר העתידי', outage.paths.includes('/books/c'), false);

console.log('\nסף הביטול הגורף');

const many = scan({
  books: Array.from({ length: 200 }, (_, i) =>
    book({ slug: `book-${i}`, saleStartsAt: INSIDE, authorSlug: `author-${i}` }),
  ),
});
check(`200 ספרים חורגים מהסף (${OVERFLOW_THRESHOLD})`, many.overflow, true);
check('אבל הסריקה והקיבוץ קרו בכל מקרה', many.counts.books, 200);

const few = scan({ books: [book({ slug: 'x', saleStartsAt: INSIDE })] });
check('ספר אחד אינו חורג', few.overflow, false);

console.log('\nקבועים');
check('מפתח הסמן', CURSOR_KEY, 'revalidation_cursor_at');
check('חלון ברירת המחדל ארוך מתדירות הקרון (15 דק׳)', DEFAULT_LOOKBACK_MS > 15 * 60_000, true);

/* ==========================================================================
   הסמן וההרצה בפועל
   ==========================================================================

   ‏runBoundaryRevalidation נבדק מול transport מוחלף: התשובות מוכנות,
   ‏revalidatePath מתועד ב-globalThis (ראו scripts/resolve-server-only.mjs),
   וכך אפשר לאמת את שתי הטענות שאי אפשר לאמת בקריאה — **כמה** רענונים
   יצאו, ו**אם** הסמן התקדם.
   ========================================================================== */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://stub.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'stub-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-service';

/** מה ה"מסד" יחזיר, ומה נכתב אליו. */
let settingsExtra = {};
let booksRows = [];
let bannersRows = [];
let eventsRows = [];
let cursorWrites = [];
let failSelect = false;

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const href = typeof url === 'string' ? url : url.toString();
  const method = init?.method ?? 'GET';

  if (href.includes('site_settings')) {
    if (method === 'PATCH') {
      const body = JSON.parse(init.body);
      cursorWrites.push(body.extra?.[CURSOR_KEY] ?? null);
      settingsExtra = body.extra;
      return json([{ id: 1 }]);
    }
    return json([{ extra: settingsExtra }]);
  }
  if (failSelect) {
    return new Response(JSON.stringify({ message: 'stub select failure' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (href.includes('/books')) return json(booksRows);
  if (href.includes('/banners')) return json(bannersRows);
  if (href.includes('/events')) return json(eventsRows);
  if (href.includes('store_settings')) return json([{ id: 1, store_enabled: true, extra: {} }]);
  return json([]);
};

function json(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

const { runBoundaryRevalidation } = await import('../src/lib/revalidation/run.ts');

/** מאפס את כל המצב ומריץ. מחזיר את התוצאה ואת הרענונים שיצאו בפועל. */
async function run({ books = [], banners = [], events = [], cursorAt, shouldThrow = false, selectFails = false } = {}) {
  booksRows = books;
  bannersRows = banners;
  eventsRows = events;
  settingsExtra = cursorAt === undefined ? {} : { [CURSOR_KEY]: cursorAt };
  cursorWrites = [];
  failSelect = selectFails;
  globalThis.__revalidateCalls = [];
  globalThis.__revalidateShouldThrow = shouldThrow;
  const result = await runBoundaryRevalidation();
  globalThis.__revalidateShouldThrow = false;
  return { result, revalidated: globalThis.__revalidateCalls, cursorWrites };
}

const recent = new Date(Date.now() - 5 * 60_000).toISOString();

console.log('\nריצה ריקה — אפס רענון, סמן כן מתקדם');

const emptyRun = await run({ cursorAt: recent });
check('אף revalidatePath לא נקרא', emptyRun.revalidated, []);
check('התוצאה done', emptyRun.result.status, 'done');
check('הסמן התקדם', emptyRun.result.cursorAdvanced, true);
check('ונכתב פעם אחת', emptyRun.cursorWrites.length, 1);

console.log('\nריצה עם גבול — רענון ממוקד, ואז קידום סמן');

const saleRun = await run({
  cursorAt: recent,
  books: [
    {
      slug: 'sefer',
      sale_starts_at: new Date(Date.now() - 60_000).toISOString(),
      sale_ends_at: null,
      author: { slug: 'raam' },
    },
  ],
});
check('נקראו שמונה נתיבים קונקרטיים', saleRun.revalidated.length, 8);
check('בלי תבנית wildcard', saleRun.revalidated.some((p) => p.includes('[')), false);
check('כולל את עמוד הספר בשתי השפות', 
  saleRun.revalidated.includes('/books/sefer') && saleRun.revalidated.includes('/en/books/sefer'), true);
check('כולל את עמוד המחבר', saleRun.revalidated.includes('/authors/raam'), true);
check('הסמן התקדם אחרי הרענון', saleRun.result.cursorAdvanced, true);
check('revalidated בתוצאה תואם', saleRun.result.revalidated, 8);

console.log('\nכשל ברענון — הסמן אינו מתקדם');

const failRun = await run({
  cursorAt: recent,
  shouldThrow: true,
  books: [
    { slug: 'sefer', sale_starts_at: new Date(Date.now() - 60_000).toISOString(), sale_ends_at: null, author: null },
  ],
});
check('התוצאה failed', failRun.result.status, 'failed');
check('הסמן לא התקדם', failRun.result.cursorAdvanced, false);
check('ולא נכתב בכלל', failRun.cursorWrites, []);

console.log('\nכשל בשליפה — גם כאן הסמן אינו מתקדם');

const selectFail = await run({ cursorAt: recent, selectFails: true });
check('התוצאה failed', selectFail.result.status, 'failed');
check('הסמן לא נכתב', selectFail.cursorWrites, []);
check('ואף רענון לא יצא', selectFail.revalidated, []);

console.log('\nסמן חסר או שגוי');

const noCursor = await run({ cursorAt: undefined });
check('בלי סמן — הריצה מצליחה ומתחילה חלון ברירת מחדל', noCursor.result.status, 'done');
check('והסמן נכתב', noCursor.cursorWrites.length, 1);

const futureCursor = await run({ cursorAt: new Date(Date.now() + 86_400_000).toISOString() });
check('סמן מהעתיד — מטופל כאילו אינו קיים, בלי חלון שלילי', futureCursor.result.status, 'done');
check(
  'החלון שנסרק אינו הפוך',
  Date.parse(futureCursor.result.from) < Date.parse(futureCursor.result.to),
  true,
);

globalThis.fetch = realFetch;

console.log(
  failed === 0 ? '\nכל בדיקות סורק הגבולות עברו.' : `\n${failed} בדיקות נכשלו.`,
);
process.exit(failed === 0 ? 0 : 1);
