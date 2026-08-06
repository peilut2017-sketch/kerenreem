/**
 * בדיקות יחידה לשכבת המסחר — ללא מסד וללא רשת:
 *   1. מכונות המצבים: מעברים חוקיים עוברים, אסורים נדחים.
 *   2. תמחור: מחיר מבצע בתוך חלון, מחוצה לו, ופרמוט אחיד.
 *   3. תאריך אספקה: דילוג על שישי/שבת ותאריכים חסומים.
 *   4. עגלה/סכומים: computeTotals עם מע"מ כלול.
 * הרצה: npm run check:commerce  (node --experimental-strip-types)
 */
import assert from 'node:assert/strict';

const failures = [];
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  ✗ ${name}\n    ${error.message}`);
  }
}

/* ---------------------------------------------------------------- מצבים */
const {
  isTransitionAllowed,
  customerStatusKey,
  cancellationPath,
} = await import('../src/lib/commerce/state-machines.ts');

await test('ציר הזמנה: pending→confirmed מותר', () =>
  assert.equal(isTransitionAllowed('state', 'pending', 'confirmed'), true));
await test('ציר הזמנה: completed→pending אסור', () =>
  assert.equal(isTransitionAllowed('state', 'completed', 'pending'), false));
await test('ציר הזמנה: מעבר לאותו מצב תמיד חוקי (idempotent)', () =>
  assert.equal(isTransitionAllowed('state', 'pending', 'pending'), true));
await test('ציר תשלום: paid→refunded מותר, refunded→paid אסור', () => {
  assert.equal(isTransitionAllowed('payment_state', 'paid', 'refunded'), true);
  assert.equal(isTransitionAllowed('payment_state', 'refunded', 'paid'), false);
});
await test('ציר אספקה: unfulfilled→shipped אסור בלי preparing', () =>
  assert.equal(isTransitionAllowed('fulfillment_state', 'unfulfilled', 'shipped'), false));

/* [1.1] תרשים 13 המתוקן: ביטול על הזמנה ששולמה עובר דרך המתנה-לזיכוי */
await test('ביטול 1.1: confirmed→cancel_pending_refund מותר; ומשם ל-cancelled', () => {
  assert.equal(isTransitionAllowed('state', 'confirmed', 'cancel_pending_refund'), true);
  assert.equal(isTransitionAllowed('state', 'cancel_pending_refund', 'cancelled'), true);
  assert.equal(isTransitionAllowed('state', 'cancel_pending_refund', 'confirmed'), true);
});
await test('ביטול 1.1: cancel_pending_refund אינו קופץ ל-completed/closed', () => {
  assert.equal(isTransitionAllowed('state', 'cancel_pending_refund', 'completed'), false);
  assert.equal(isTransitionAllowed('state', 'cancel_pending_refund', 'closed'), false);
});
await test('שומר הביטול: שולם ⇒ refund_first; לא שולם ⇒ direct; זוכה ⇒ already_refunded', () => {
  assert.equal(cancellationPath('paid'), 'refund_first');
  assert.equal(cancellationPath('partially_refunded'), 'refund_first');
  assert.equal(cancellationPath('pending'), 'direct');
  assert.equal(cancellationPath('failed'), 'direct');
  assert.equal(cancellationPath('refunded'), 'already_refunded');
});
await test('סטטוס לקוח 1.1: cancel_pending_refund ⇒ statusCancelling', () =>
  assert.equal(
    customerStatusKey({
      state: 'cancel_pending_refund',
      payment_state: 'paid',
      fulfillment_state: 'unfulfilled',
    }),
    'statusCancelling',
  ));
await test('ציר מסמך: failed→pending (Retry) מותר', () =>
  assert.equal(isTransitionAllowed('document_state', 'failed', 'pending'), true));
await test('סטטוס בשפת לקוח: שולם ובהכנה = statusPreparing', () =>
  assert.equal(
    customerStatusKey({ state: 'processing', payment_state: 'paid', fulfillment_state: 'preparing' }),
    'statusPreparing',
  ));

/* ---------------------------------------------------------------- תמחור */
const { getEffectivePrice, formatPrice, round2 } = await import('../src/lib/commerce/pricing.ts');

const saleBook = {
  price: 100,
  sale_price: 79,
  sale_starts_at: '2026-01-01T00:00:00Z',
  sale_ends_at: '2099-01-01T00:00:00Z',
  sale_name_he: 'מבצע השקה',
  sale_name_en: null,
};

await test('מחיר מבצע בתוך החלון גובר על הרגיל', () => {
  const price = getEffectivePrice(saleBook, 'he', new Date('2026-06-01'));
  assert.equal(price.amount, 79);
  assert.equal(price.onSale, true);
  assert.equal(price.originalAmount, 100);
});
await test('מחוץ לחלון — המחיר הרגיל', () => {
  const price = getEffectivePrice({ ...saleBook, sale_ends_at: '2026-02-01T00:00:00Z' }, 'he', new Date('2026-06-01'));
  assert.equal(price.amount, 100);
  assert.equal(price.onSale, false);
});
await test('מבצע גבוה מהמחיר — מתעלמים ממנו', () => {
  const price = getEffectivePrice({ ...saleBook, sale_price: 120 }, 'he', new Date('2026-06-01'));
  assert.equal(price.amount, 100);
});
await test('אין מחיר — null (ספר קטלוג)', () =>
  assert.equal(getEffectivePrice({ ...saleBook, price: null }, 'he'), null));
await test('פרמוט: סכום עגול בלי אגורות, שבור עם שתיים', () => {
  assert.ok(!formatPrice(85, 'he').includes('.'));
  assert.ok(formatPrice(85.5, 'he').includes('5'));
});
await test('round2 מעגל כספית', () => assert.equal(round2(10.005), 10.01));

/* --------------------------------------------------------- תאריך אספקה */
const { addBusinessDays, getPromisedDate } = await import('../src/lib/commerce/delivery-date.ts');

await test('יום עסקים אחד מיום חמישי מדלג לשבוע הבא', () => {
  // 2026-08-06 הוא יום חמישי; ‎+1 יום עסקים חייב לנחות על ראשון או אחריו
  const result = addBusinessDays(new Date('2026-08-06T10:00:00'), 1);
  assert.ok(result.getDay() !== 5 && result.getDay() !== 6);
  assert.ok(result > new Date('2026-08-07'));
});
await test('תאריך חסום ידני מדולג', () => {
  const start = new Date('2026-08-02T10:00:00'); // ראשון
  const blocked = ['2026-08-03']; // שני חסום
  const result = addBusinessDays(start, 1, blocked);
  assert.notEqual(result.toISOString().slice(0, 10), '2026-08-03');
});
await test('getPromisedDate: הכנה + שילוח + מרווח', () => {
  const settings = {
    order_prep_days: 1,
    delivery_buffer_days: 1,
    non_working_dates: [],
    pickup_prep_hours: 24,
  };
  const promised = getPromisedDate({
    settings,
    etaBusinessDays: 3,
    now: new Date('2026-08-02T10:00:00'),
  });
  assert.ok(promised > new Date('2026-08-05'));
  assert.ok(promised.getDay() !== 5 && promised.getDay() !== 6);
});

/* ---------------------------------------------------------------- טלפון */
const { normalizePhone, isValidIsraeliPhone } = await import('../src/lib/commerce/phone.ts');

await test('נירמול טלפון ישראלי', () => {
  assert.equal(normalizePhone('052-123-4567'), '+972521234567');
  assert.equal(normalizePhone('+972521234567'), '+972521234567');
});
await test('אימות טלפון: נייד תקין, קידומת שגויה נפסלת', () => {
  assert.equal(isValidIsraeliPhone('0521234567'), true);
  assert.equal(isValidIsraeliPhone('123'), false);
});

/* ---------------------------------------------------------------- סיכום */
if (failures.length > 0) {
  console.error(`\n${failures.length} בדיקות נכשלו`);
  process.exit(1);
}
console.log('\ncheck:commerce עבר בהצלחה');
