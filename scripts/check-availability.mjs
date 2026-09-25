/**
 * ‏[1.42] בדיקת הזמינות החיה — השכבה שמחליפה את ISR על עמודי הספרים.
 *
 * הרצה: node --experimental-strip-types scripts/check-availability.mjs
 *
 * למה בדיקה: אחרי שהזמינות הוצאה מה-HTML הסטטי, הפונקציה הזו היא מה
 * שמחליט אם יופיע כפתור "הוספה לסל". טעות כאן פירושה או ספר שאזל
 * שנראה זמין, או ספר במלאי שאי אפשר לקנות — ושתיהן שקטות לחלוטין.
 *
 * הבדיקה אינה פונה למסד אמיתי: ה-transport של supabase-js הוא fetch,
 * והוא מוחלף כאן בתשובות PostgREST מוכנות. כך נבדק הקוד שלנו, כולל
 * מיפוי הזמינות, בלי תלות בסביבה.
 */
import { register } from 'node:module';

register(new URL('./resolve-server-only.mjs', import.meta.url));

const original = globalThis.fetch;

// מוגדר לפני הייבוא: isSupabaseConfigured נקרא בזמן טעינת המודול.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://stub.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'stub-anon-key';

/** השורות שה"מסד" יחזיר, והכתובות שנתבקשו — כדי לאמת גם את השאילתה. */
let rows = [];
const calls = [];

globalThis.fetch = async (url) => {
  const href = typeof url === 'string' ? url : url.toString();
  calls.push(href);
  // ‏site_settings / store_settings — דגלי החנות. חנות פעילה.
  if (href.includes('site_settings') || href.includes('store_settings')) {
    return jsonResponse([{ id: 1, store_enabled: true, extra: {} }]);
  }
  return jsonResponse(rows);
};

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

const { getLiveAvailability } = await import('../src/lib/books/availability-actions.ts');

const BASE = {
  is_purchasable: true,
  price: 89,
  stock_quantity: 5,
  preorder_enabled: false,
  is_stock_managed: true,
};

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

async function ask(book, ids = ['b1']) {
  rows = book === null ? [] : [{ id: 'b1', ...book }];
  calls.length = 0;
  const result = await getLiveAvailability(ids);
  return result;
}

console.log('מיפוי הזמינות — in stock ⇄ out of stock\n');

check('מלאי חיובי → in_stock, ניתן לרכישה', await ask({ ...BASE, stock_quantity: 5 }), [
  { bookId: 'b1', availability: 'in_stock', availableQuantity: 5, purchasable: true },
]);

check('מלאי אפס → out_of_stock, לא ניתן לרכישה', await ask({ ...BASE, stock_quantity: 0 }), [
  { bookId: 'b1', availability: 'out_of_stock', availableQuantity: 0, purchasable: false },
]);

check('מלאי שלילי אינו זולג לכמות שלילית', await ask({ ...BASE, stock_quantity: -3 }), [
  { bookId: 'b1', availability: 'out_of_stock', availableQuantity: 0, purchasable: false },
]);

check('המלאי חזר → in_stock שוב', await ask({ ...BASE, stock_quantity: 1 }), [
  { bookId: 'b1', availability: 'in_stock', availableQuantity: 1, purchasable: true },
]);

console.log('\nמצבים שאינם תלויי מלאי');

check(
  'הזמנה מוקדמת → preorder, ניתן לרכישה, בלי כמות',
  await ask({ ...BASE, stock_quantity: 0, preorder_enabled: true }),
  [{ bookId: 'b1', availability: 'preorder', availableQuantity: null, purchasable: true }],
);

/*
 * ‏[1.42] ספר בלי ניהול מלאי זמין תמיד — גם כשהמונה 0.
 *
 * זה היה באג: ‏getBookAvailability בדק את stock_quantity לבדו והתעלם
 * מ-is_stock_managed, בעוד validateCart (cart.ts:194) כן התייחס אליו.
 * התוצאה — "אזל" בקטלוג בלי כפתור, אבל מכירה בפועל אם הספר כבר בסל.
 * שתי השכבות מיושרות עכשיו, ו-validateCart לא נגע.
 */
check(
  'מלאי לא מנוהל + מונה 0 → in_stock, ניתן לרכישה',
  await ask({ ...BASE, stock_quantity: 0, is_stock_managed: false }),
  [{ bookId: 'b1', availability: 'in_stock', availableQuantity: null, purchasable: true }],
);

check(
  'מלאי לא מנוהל + מונה חיובי → in_stock, בלי כמות מוצגת',
  await ask({ ...BASE, stock_quantity: 4, is_stock_managed: false }),
  [{ bookId: 'b1', availability: 'in_stock', availableQuantity: null, purchasable: true }],
);

check(
  'השדה חסר בשליפה (undefined) → מתנהג כמנוהל, ההתנהגות הישנה נשמרת',
  await ask({ is_purchasable: true, price: 89, stock_quantity: 0, preorder_enabled: false }),
  [{ bookId: 'b1', availability: 'out_of_stock', availableQuantity: 0, purchasable: false }],
);

check('בלי מחיר → catalog_only, לא ניתן לרכישה', await ask({ ...BASE, price: null }), [
  { bookId: 'b1', availability: 'catalog_only', availableQuantity: 5, purchasable: false },
]);

check(
  'לא ניתן לרכישה → catalog_only',
  await ask({ ...BASE, is_purchasable: false }),
  [{ bookId: 'b1', availability: 'catalog_only', availableQuantity: 5, purchasable: false }],
);

console.log('\nחוזה הקלט');

check('מערך ריק → בלי שאילתה בכלל', await ask(null, []), []);
check('ספר שאינו מפורסם/נמחק → אינו מוחזר', await ask(null, ['b1']), []);

rows = [{ id: 'b1', ...BASE }];
calls.length = 0;
await getLiveAvailability(['b1', 'b1', 'b1', '', 'b1']);
const idsInQuery = decodeURIComponent(calls.find((c) => c.includes('books')) ?? '');
check('כפילויות וערכים ריקים מסוננים', /in\.\("?b1"?\)/.test(idsInQuery), true);

calls.length = 0;
await getLiveAvailability(Array.from({ length: 300 }, (_, i) => `id-${i}`));
const capped = decodeURIComponent(calls.find((c) => c.includes('books')) ?? '');
const countInQuery = (capped.match(/id-/g) ?? []).length;
check('תקרה של 120 מזהים נאכפת', countInQuery, 120);

calls.length = 0;
await getLiveAvailability(['b1', 'b2', 'b3']);
const bookQueries = calls.filter((c) => c.includes('/books')).length;
check('שאילתה אחת לכל המזהים — בלי N+1', bookQueries, 1);

globalThis.fetch = original;

console.log(
  failed === 0 ? '\nכל בדיקות הזמינות עברו.' : `\n${failed} בדיקות נכשלו.`,
);
process.exit(failed === 0 ? 0 : 1);
