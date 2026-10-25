/**
 * מטמון-התוכן הציבורי: מה נשמר, מה חייב להישאר חי, ומי מבטל.
 *
 * הרצה: node --experimental-strip-types scripts/check-content-cache.mjs
 *
 * ‏**מה הבדיקה הזו מוכיחה ומה לא.** Next האמיתי אינו רץ כאן. ה-fetch מוחלף
 * במודל קטן של מטמון-הנתונים (force-cache נשמר עד שהתג פוקע, no-store ובקשה
 * בלי הנחיה אינן נשמרות), ו-updateTag/revalidateTag מחוברים אליו. לכן היא
 * מוכיחה את החיווט של הקוד שלנו:
 *   - אילו בקשות נושאות הנחיית מטמון ותג, ואילו לא;
 *   - שהתג שבשליפה הוא אותו תג שמבטלים;
 *   - ששולפי מסחר ובריאות (עגלה, זמינות, health) מגיעים למסד בכל קריאה;
 *   - שכל נתיב שמרענן עמוד ציבורי מבטל את התג, או מופיע ברשימת החריגים
 *     עם נימוק.
 * היא **אינה** מוכיחה שמטמון-הנתונים של Next או של Vercel מתנהג כך בפועל,
 * ששגיאה נלכדת נכון בזמן ריצה אמיתי, או שהמסלולים הציבוריים נשארים סטטיים
 * בפריסה. את אלה בודקים רק next build + next start (או Preview) מול מסד.
 */
import { register } from 'node:module';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

register(new URL('./resolve-server-only.mjs', import.meta.url));

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://stub.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'stub-anon';
process.env.HEALTH_CHECK_SECRET = 'health-secret';

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

const TAG = 'sb:public';

/* ==========================================================================
   מודל מטמון-הנתונים
   ========================================================================== */

/** table → שורות. הבדיקה משנה אותן כדי לדמות עדכון במסד. */
const tables = {};
/** כל בקשה שהגיעה ל-"רשת", עם מקורה (מסד / מטמון). */
let calls = [];
const dataCache = new Map();

globalThis.__onTagExpire = (tag) => {
  for (const [key, entry] of dataCache) if (entry.tags.has(tag)) dataCache.delete(key);
};

function reset() {
  calls = [];
  dataCache.clear();
  globalThis.__tagCalls = [];
  globalThis.__callOrder = [];
  globalThis.__tagShouldThrow = false;
}

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = (init.method ?? 'GET').toUpperCase();
  const table = /\/rest\/v1\/([^?/]+)/.exec(url)?.[1] ?? null;
  const tags = init.next?.tags ?? [];
  const cacheable = init.cache === 'force-cache' && (method === 'GET' || method === 'HEAD');
  const key = `${method} ${url}`;
  const meta = { table, method, cache: init.cache, tags, hasNext: 'next' in init };

  if (cacheable && dataCache.has(key)) {
    calls.push({ ...meta, source: 'cache' });
    return new Response(dataCache.get(key).body, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  calls.push({ ...meta, source: 'db' });
  const body = JSON.stringify(tables[table] ?? []);
  if (cacheable) dataCache.set(key, { body, tags: new Set(tags) });
  return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
};

const dbCalls = (table) => calls.filter((c) => c.table === table && c.source === 'db');
const allFromDb = (table) => calls.filter((c) => c.table === table).every((c) => c.source === 'db');

/* ==========================================================================
   א. עטיפות ה-fetch
   ========================================================================== */

console.log('עטיפות ה-fetch (יחידה)');

const server = await import('../src/lib/supabase/server.ts');
const { PUBLIC_CONTENT_CACHE_TAG, expirePublicContentAfterSave, expirePublicContentNow } = await import(
  '../src/lib/revalidation/content-cache.ts'
);

check('התג', PUBLIC_CONTENT_CACHE_TAG, TAG);

/** base מוחלף שמחזיר מה שקיבל — כדי לבדוק בדיוק מה עוטף שולח. */
const seen = [];
const base = async (input, init) => {
  seen.push({ input, init });
  return new Response('[]');
};
const REST = 'https://x.supabase.co/rest/v1/books?select=*';

const content = server.createContentFetch(base);
seen.length = 0;
await content(REST);
check('קריאת GET אל PostgREST: force-cache + תג', [seen[0].init.cache, seen[0].init.next], ['force-cache', { tags: [TAG] }]);
check('בלי revalidate — אין חלון זמן, ולכן המסלול אינו הופך ל-ISR', 'revalidate' in seen[0].init.next, false);
seen.length = 0;
await content(REST, { method: 'HEAD' });
check('HEAD אל PostgREST נשמר גם הוא', seen[0].init.cache, 'force-cache');
seen.length = 0;
await content(REST, { method: 'POST', body: '{}' });
check('POST (כתיבה / rpc): עובר כמות שהוא', [seen[0].init.cache, seen[0].init.next], [undefined, undefined]);
seen.length = 0;
await content('https://x.supabase.co/auth/v1/user');
check('auth: עובר כמות שהוא', [seen[0].init, 'cache' in (seen[0].init ?? {})], [undefined, false]);
seen.length = 0;
await content('https://x.supabase.co/storage/v1/object/public/a.png');
check('storage: עובר כמות שהוא', seen[0].init, undefined);
seen.length = 0;
await content(new Request(REST, { method: 'DELETE' }));
check('אובייקט Request עם method של כתיבה: לא נשמר', seen[0].init?.cache, undefined);
seen.length = 0;
await content(new Request(REST));
check('אובייקט Request מסוג GET: נשמר', seen[0].init.cache, 'force-cache');

const live = server.createLiveFetch(base);
for (const [label, target, init] of [
  ['GET', REST, undefined],
  ['POST', REST, { method: 'POST' }],
  ['auth', 'https://x.supabase.co/auth/v1/user', undefined],
]) {
  seen.length = 0;
  await live(target, init);
  check(`חי, ${label}: no-store מפורש וללא תגים`, [seen[0].init.cache, 'next' in seen[0].init], ['no-store', false]);
}

/* ==========================================================================
   ב. הלקוחות האמיתיים מול supabase-js
   ========================================================================== */

console.log('\nהלקוחות מול supabase-js (מה באמת יוצא ל-fetch)');

reset();
tables.books = [{ id: 'b1' }];
await server.createStaticClient().from('books').select('id');
check('createStaticClient: בלי הנחיית מטמון ובלי תג (ברירת המחדל של Next)', [calls[0].cache, calls[0].tags, calls[0].hasNext], [undefined, [], false]);

reset();
await server.createContentClient().from('books').select('id');
check('createContentClient: force-cache + תג', [calls[0].cache, calls[0].tags], ['force-cache', [TAG]]);

reset();
await server.createContentClient().rpc('increment_book_view', { target_slug: 'x' });
check('createContentClient, rpc (POST): לא נשמר', [calls[0].method, calls[0].cache, calls[0].tags], ['POST', undefined, []]);

reset();
await server.createLiveClient().from('books').select('id');
check('createLiveClient: no-store וללא תג', [calls[0].cache, calls[0].tags, calls[0].hasNext], ['no-store', [], false]);

/* ==========================================================================
   ג. שולפים אמיתיים מול המודל: שמירה, ביטול ושליפה מחדש
   ========================================================================== */

console.log('\nשולפי תוכן (data.ts): שמירה → ביטול → שליפה מחדש');

const data = await import('../src/lib/data.ts');

reset();
tables.authors = [{ id: 'a1', slug: 'a', name_he: 'שם ישן', is_published: true }];
const first = await data.getAuthors();
await data.getAuthors();
check('שתי קריאות → פנייה אחת למסד (השנייה מהמטמון)', dbCalls('authors').length, 1);
check('השליפה מתויגת', calls[0].tags, [TAG]);

tables.authors = [{ id: 'a1', slug: 'a', name_he: 'שם חדש', is_published: true }];
const stale = await data.getAuthors();
check('שינוי במסד בלי ביטול: עדיין הגרסה השמורה', [first[0].name_he, stale[0].name_he], ['שם ישן', 'שם ישן']);

check('ביטול מתוך Server Action מדווח הצלחה', expirePublicContentAfterSave(), true);
check('ונרשם כ-updateTag על התג שבשליפה', globalThis.__tagCalls, [{ fn: 'updateTag', tag: TAG }]);
const fresh = await data.getAuthors();
check('אחרי הביטול: שליפה מחדש מהמסד, הערך החדש', fresh[0].name_he, 'שם חדש');
check('וזו הפנייה השנייה למסד', dbCalls('authors').length, 2);

reset();
tables.events = [{ id: 'e1', slug: 'e', title_he: 'ישן', is_published: true }];
await data.getEvents();
tables.events = [{ id: 'e1', slug: 'e', title_he: 'חדש', is_published: true }];
expirePublicContentNow();
check('ביטול מ-Route Handler: revalidateTag עם { expire: 0 }', globalThis.__tagCalls, [
  { fn: 'revalidateTag', tag: TAG, profile: { expire: 0 } },
]);
check('ואף הוא גורם לשליפה מחדש', (await data.getEvents())[0].title_he, 'חדש');

console.log('\nמחיר ומלאי בשליפות תוכן: ברירת מחדל שמורה, { live: true } תמיד מהמסד');

const bookRow = (price, stock) => ({
  id: 'b1',
  slug: 'b',
  title_he: 'ספר',
  price,
  stock_quantity: stock,
  is_published: true,
  is_purchasable: true,
});

reset();
tables.books = [bookRow(100, 5)];
const cachedBefore = await data.getBooks();
tables.books = [bookRow(90, 0)];
const cachedAfter = await data.getBooks();
check('getBooks() ברירת מחדל: מהמטמון (מחיר ישן)', [cachedBefore[0].price, cachedAfter[0].price], [100, 100]);
const liveAfter = await data.getBooks({ live: true });
check('getBooks({ live: true }): מחיר ומלאי עדכניים מהמסד', [liveAfter[0].price, liveAfter[0].stock_quantity], [90, 0]);
const liveCalls = calls.filter((c) => c.cache === 'no-store');
check('והבקשה נושאת no-store ובלי תג', [liveCalls.length >= 1, liveCalls.every((c) => c.tags.length === 0)], [true, true]);
tables.books = [bookRow(80, 3)];
check('getBooksByIds({ live: true }): עדכני בכל קריאה', (await data.getBooksByIds(['b1'], { live: true }))[0].price, 80);
const byIdsCached = await data.getBooksByIds(['b1']);
tables.books = [bookRow(70, 3)];
check('getBooksByIds() ברירת מחדל: נשמר', (await data.getBooksByIds(['b1']))[0].price, byIdsCached[0].price);

console.log('\nמתג החנות והגדרות: לעולם לא במטמון-התוכן');

reset();
tables.site_settings = [{ id: 1, store_enabled: true }];
const siteBefore = await data.getSiteSettings();
tables.site_settings = [{ id: 1, store_enabled: false }];
const siteAfter = await data.getSiteSettings();
check('store_enabled מתעדכן מיד, בלי ביטול תג', [siteBefore.store_enabled, siteAfter.store_enabled], [true, false]);
check('וכל הפניות הלכו למסד', allFromDb('site_settings'), true);
check('בלי הנחיית מטמון ובלי תג', calls.every((c) => c.cache === undefined && c.tags.length === 0), true);

/* ==========================================================================
   ד. קריאות מסחר ובריאות: תמיד מהמסד
   ========================================================================== */

console.log('\nעגלה (validateCart): מחיר ומלאי חיים');

const { validateCart } = await import('../src/lib/commerce/cart.ts');

const cartBook = (price, stock) => ({
  id: 'b1',
  slug: 'b',
  title_he: 'ספר',
  title_en: null,
  author_name_he: null,
  author_name_en: null,
  category_id: null,
  cover_image_url: null,
  price,
  sale_price: null,
  sale_starts_at: null,
  sale_ends_at: null,
  sale_name_he: null,
  sale_name_en: null,
  currency: 'ILS',
  stock_quantity: stock,
  is_published: true,
  is_purchasable: true,
  preorder_enabled: false,
  weight_grams: 300,
  free_shipping_eligible: false,
  is_stock_managed: true,
  prep_days_override: null,
});

reset();
tables.site_settings = [{ id: 1, store_enabled: true }];
tables.store_settings = [{ id: 1 }];
tables.books = [cartBook(100, 5)];
// מחממים את מטמון התוכן עם המחיר הישן, כמו עמוד קטלוג שנבנה קודם
await data.getBooks();
tables.books = [cartBook(90, 5)];
const cartA = await validateCart([{ bookId: 'b1', quantity: 1 }]);
check('validateCart רואה את המחיר החדש מיד (90, לא 100 שבמטמון)', [cartA.lines[0].unitPrice, cartA.lines[0].quantity], [90, 1]);
tables.books = [cartBook(90, 0)];
const cartB = await validateCart([{ bookId: 'b1', quantity: 1 }]);
check(
  'ואת המלאי החדש בקריאה הבאה: אזל, והשורה מסומנת',
  [cartB.lines[0].availability, cartB.lines[0].quantity, cartB.changes[0]?.kind],
  ['out_of_stock', 0, 'unavailable'],
);
const cartCalls = calls.filter((c) => c.table === 'books' && c.cache === 'no-store');
check('שאילתת הספרים בעגלה: no-store מפורש, בלי תג', [cartCalls.length, cartCalls.every((c) => c.tags.length === 0)], [2, true]);
check('כל פניות העגלה לספרים הגיעו למסד', cartCalls.every((c) => c.source === 'db'), true);

console.log('\nזמינות מלאי (getLiveAvailability)');

const { getLiveAvailability } = await import('../src/lib/books/availability-actions.ts');
reset();
tables.books = [cartBook(100, 5)];
const availA = await getLiveAvailability(['b1']);
tables.books = [cartBook(100, 0)];
const availB = await getLiveAvailability(['b1']);
check('מלאי משתנה בין קריאות ומשתקף מיד', [availA[0]?.availableQuantity, availB[0]?.availableQuantity], [5, 0]);
const availBookCalls = calls.filter((c) => c.table === 'books');
check('הפניות לספרים: no-store, ללא תג, מהמסד', [availBookCalls.every((c) => c.cache === 'no-store' && c.tags.length === 0 && c.source === 'db'), availBookCalls.length], [true, 2]);

console.log('\nבריאות (/api/health/deep)');

const health = await import('../src/app/api/health/deep/route.ts');
reset();
tables.site_settings = [{ id: 1 }];
tables.books = [cartBook(100, 5)];
const res1 = await health.GET(new Request('https://x.test/api/health/deep', { headers: { authorization: 'Bearer health-secret' } }));
const body1 = await res1.json();
const dbCheck1 = body1.checks.find((c) => c.name === 'database');
check('הבדיקה רצה ומחזירה ok', dbCheck1?.status, 'ok');
tables.site_settings = [];
const healthCalls = calls.filter((c) => c.table === 'site_settings' || c.table === 'books');
check('פניות health: no-store, ללא תג, מהמסד', [healthCalls.length > 0, healthCalls.every((c) => c.cache === 'no-store' && c.tags.length === 0 && c.source === 'db')], [true, true]);
const unauthorized = await health.GET(new Request('https://x.test/api/health/deep'));
check('ובלי סוד — 401, בלי פנייה למסד', unauthorized.status, 401);

/* ==========================================================================
   ה. סריקת מבנה — מי משתמש באיזה לקוח
   ========================================================================== */

console.log('\nסריקת מבנה: מי משתמש באיזה לקוח');

const ROOT = new URL('..', import.meta.url).pathname;
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}
const files = walk(join(ROOT, 'src')).map((f) => ({ path: relative(ROOT, f), text: readFileSync(f, 'utf8') }));
const filesUsing = (name) =>
  files.filter((f) => new RegExp(`\\b${name}\\s*\\(`).test(f.text) && f.path !== 'src/lib/supabase/server.ts').map((f) => f.path).sort();

check('createContentClient: רק data.ts', filesUsing('createContentClient'), ['src/lib/data.ts']);

check(
  'createStaticClient: רק data.ts (כתיבה + הגדרות), הגדרות חנות ומשלוח',
  filesUsing('createStaticClient'),
  ['src/lib/commerce/settings.ts', 'src/lib/commerce/shipping.ts', 'src/lib/data.ts'],
);

check(
  'createLiveClient: עגלה, זמינות, health, diagnostics, ו-data.ts (דרך { live: true })',
  filesUsing('createLiveClient'),
  [
    'src/app/(admin)/admin/(dashboard)/diagnostics/page.tsx',
    'src/app/api/health/deep/route.ts',
    'src/lib/books/availability-actions.ts',
    'src/lib/commerce/cart.ts',
    'src/lib/data.ts',
  ],
);

/** שם הפונקציה המיוצאת שמכילה כל שימוש בלקוח, בתוך data.ts. */
function clientUsesByGetter(source, client) {
  const result = [];
  const re = /^export (?:async function|const) (\w+)/gm;
  const starts = [...source.matchAll(re)].map((m) => ({ name: m[1], at: m.index }));
  for (let i = 0; i < starts.length; i += 1) {
    const body = source.slice(starts[i].at, starts[i + 1]?.at ?? source.length);
    if (new RegExp(`\\b${client}\\s*\\(`).test(body)) result.push(starts[i].name);
  }
  return result.sort();
}
const dataSource = files.find((f) => f.path === 'src/lib/data.ts').text;
check('ב-data.ts רק הכתיבה וההגדרות על הלקוח הרגיל', clientUsesByGetter(dataSource, 'createStaticClient'), [
  'getSiteSettingsResult',
  'incrementBookView',
]);
check(
  'ו-createLiveClient ב-data.ts רק בבורר { live } האחד',
  (dataSource.match(/createLiveClient\s*\(/g) ?? []).length,
  1,
);

/** הקשרי ריצה שאסור להם מחיר/מלאי ממטמון: כל קריאה ל-getBooks/getBooksByIds חייבת live. */
const RUNTIME = [
  'src/lib/search-actions.ts',
  'src/lib/commerce/favourites-actions.ts',
  'src/app/(public)/[locale]/account/(guarded)/page.tsx',
  'src/app/(admin)/admin/(dashboard)/diagnostics/page.tsx',
];
/** קריאות ממשיות (await / return / איבר בשורה משלו), לא אזכורים בהערות, במחרוזות או בטקסט JSX. */
function realCalls(text, name) {
  const found = [];
  const re = new RegExp(`(?:\\bawait\\s+|\\breturn\\s+|^\\s*)${name}\\(`, 'gm');
  for (const match of text.matchAll(re)) {
    const lineStart = text.lastIndexOf('\n', match.index) + 1;
    const prefix = text.slice(lineStart, match.index + match[0].length);
    if (/^\s*(\/\/|\*|\/\*)/.test(prefix)) continue;
    let depth = 1;
    let i = match.index + match[0].length;
    const start = i;
    while (i < text.length && depth > 0) {
      if (text[i] === '(') depth += 1;
      if (text[i] === ')') depth -= 1;
      i += 1;
    }
    found.push(text.slice(start, i - 1));
  }
  return found;
}

for (const path of RUNTIME) {
  const text = files.find((f) => f.path === path).text;
  const args = [...realCalls(text, 'getBooks'), ...realCalls(text, 'getBooksByIds')];
  check(
    `${path}: כל קריאה ל-getBooks/getBooksByIds עם { live: true }`,
    [args.length > 0, args.every((a) => /live:\s*true/.test(a))],
    [true, true],
  );
}

/** כל קובץ 'use server' או נתיב api שקורא לשולפי ספרים — חייב להופיע ברשימה למעלה. */
const bookGetterCallers = files.filter(
  (f) =>
    /from '(?:@\/lib\/data|\.\/data|\.\.\/data)'/.test(f.text) &&
    /\bgetBooks(?:ByIds)?\(/.test(f.text) &&
    (/^'use server'/m.test(f.text) || f.path.startsWith('src/app/api/') || /\/account\/|\/admin\//.test(f.path)),
);
check(
  'אין קורא ריצה לשולפי ספרים שלא ברשימת { live: true }',
  bookGetterCallers.map((f) => f.path).filter((p) => !RUNTIME.includes(p)),
  [],
);

/** הנחיות מטמון אסורות מחוץ ללקוחות — מניעת "מטמון שנכנס דרך הדלת האחורית". */
const strayCaching = files
  .filter((f) => f.path !== 'src/lib/supabase/server.ts')
  .filter((f) => /force-cache|next:\s*\{\s*tags|unstable_cache|fetchCache\s*=/.test(f.text))
  .map((f) => f.path);
check('אין הנחיות מטמון נוספות בקוד האפליקציה', strayCaching, []);

/* ==========================================================================
   ו. כיסוי ביטול: כל רענון של עמוד ציבורי מבטל גם את התג — או מוצדק
   ========================================================================== */

console.log('\nכיסוי ביטול התג בכל נתיב שמרענן עמוד ציבורי');

/**
 * הכלל: כל רענון של עמוד ציבורי מלווה בביטול התג — כי עמוד שנבנה מחדש
 * אופה מחיר ומלאי של ספרים משורות מטמון-התוכן, ובלי ביטול הוא היה אופה את
 * הגרסה השמורה ולא את המסד (ישן יותר מלפני המטמון).
 *
 * החריג היחיד: רענון של מעטפת העגלה בלבד (`/[locale]/cart`). היא אינה אופה
 * מחיר או מלאי — התצוגה נבנית בלקוח מ-getCartView → validateCart, שחי.
 * הבדיקה אוכפת את זה: חריג שמרענן גם נתיב אחר נכשל.
 */
const CART_SHELL_ONLY = {
  saveShippingMethod: 'shipping_methods — מעטפת עגלה בלבד',
  saveShippingZone: 'shipping_zones — מעטפת עגלה בלבד',
  deleteShippingZone: 'shipping_zones — מעטפת עגלה בלבד',
};

const PUBLIC_REVALIDATE = /revalidatePath\(\s*(?:[`'"]\/\[locale\]|'\/'\s*,\s*'layout')/;
const EXPIRES = /expirePublicContent(?:AfterSave|Now)\(|\brevalidateEntity\(/;

const scanned = files.filter((f) => /^src\/lib\/(admin\/[\w-]+|revalidation\/run)\.ts$/.test(f.path));
const uncovered = [];
const justifiedSeen = new Set();
let coveredCount = 0;
for (const file of scanned) {
  const starts = [...file.text.matchAll(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm)].map((m) => ({
    name: m[1],
    at: m.index,
  }));
  for (let i = 0; i < starts.length; i += 1) {
    const body = file.text.slice(starts[i].at, starts[i + 1]?.at ?? file.text.length);
    if (!PUBLIC_REVALIDATE.test(body)) continue;
    if (EXPIRES.test(body)) {
      coveredCount += 1;
    } else if (starts[i].name in CART_SHELL_ONLY) {
      justifiedSeen.add(starts[i].name);
      const publicPaths = [...body.matchAll(/revalidatePath\(\s*['"`](\/\[locale\][^'"`]*|\/)['"`]/g)].map((m) => m[1]);
      if (publicPaths.some((path) => path !== '/[locale]/cart')) uncovered.push(`${file.path}:${starts[i].name} (חריג שמרענן יותר ממעטפת העגלה)`);
    } else {
      uncovered.push(`${file.path}:${starts[i].name}`);
    }
  }
}
check('אין פונקציה שמרעננת עמוד ציבורי בלי ביטול תג ובלי נימוק', uncovered, []);
check(
  'רשימת החריגים אינה מכילה שמות מתים',
  Object.keys(CART_SHELL_ONLY).filter((name) => !justifiedSeen.has(name)),
  [],
);
check('נמצאו נתיבים מכוסים (הסריקה אינה ריקה)', coveredCount >= 8, true);

const actionsText = files.find((f) => f.path === 'src/lib/admin/actions.ts').text;
const revalidateEntityBody = actionsText.slice(
  actionsText.indexOf('function revalidateEntity'),
  actionsText.indexOf('export async function revalidateAllPublicPages'),
);
check(
  'revalidateEntity מבטל את התג לפני לולאת הנתיבים (שגיאת נתיב לא מדלגת עליו)',
  revalidateEntityBody.indexOf('expirePublicContentAfterSave()') >= 0 &&
    revalidateEntityBody.indexOf('expirePublicContentAfterSave()') < revalidateEntityBody.indexOf('revalidatePath('),
  true,
);

console.log('\nכשל בביטול מתוך Server Action אינו מפיל שמירה');

reset();
globalThis.__tagShouldThrow = true;
const originalError = console.error;
console.error = () => {};
let thrown = null;
let result;
try {
  result = expirePublicContentAfterSave();
} catch (error) {
  thrown = error;
}
console.error = originalError;
globalThis.__tagShouldThrow = false;
check('לא זורק', thrown, null);
check('ומדווח false', result, false);

globalThis.fetch = realFetch;
console.log(failed === 0 ? '\nכל בדיקות מטמון-התוכן עברו.' : `\n${failed} בדיקות נכשלו.`);
process.exit(failed === 0 ? 0 : 1);
