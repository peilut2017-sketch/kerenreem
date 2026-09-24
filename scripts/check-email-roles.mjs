/**
 * בדיקת מטריצת השולח וכתובת המענה.
 *
 * הרצה: node --experimental-strip-types scripts/check-email-roles.mjs
 *
 * למה בדיקה ולא הסתמכות על הטיפוסים: ההבחנה בין `replyTo: undefined`
 * (ברירת המחדל של התפקיד) לבין `replyTo: null` ("בלי, במפורש") היא
 * הבדל של תו אחד בקוד — `=== undefined` במקום `??` — ואם הוא יישבר,
 * איפוס סיסמה יתחיל להזמין תשובות במייל בשקט מוחלט. הטיפוסים אינם
 * תופסים את זה; רק בדיקה של הבקשה שיוצאת בפועל.
 *
 * הבדיקה אינה פונה לשום שירות: fetch מוחלף, ואין צורך במפתח אמיתי.
 */

import { register } from 'node:module';

// ראו scripts/resolve-server-only.mjs — חייב לרוץ לפני הייבוא הדינמי.
register(new URL('./resolve-server-only.mjs', import.meta.url));

const original = { fetch: globalThis.fetch };

let lastBody = null;
globalThis.fetch = async (_url, init) => {
  lastBody = JSON.parse(init.body);
  return { ok: true, status: 200, json: async () => ({ id: 'test' }) };
};

process.env.RESEND_API_KEY = 'test-key';
delete process.env.EMAIL_FROM_AUTOMATED;
delete process.env.EMAIL_FROM_CONTACT;
delete process.env.EMAIL_REPLY_TO_CONTACT;
delete process.env.COMMERCE_EMAIL_FROM;

const { sendEmail } = await import('../src/lib/email/send.ts');
const { contactAddress, fromAddress, replyToForInquiry } = await import(
  '../src/lib/email/addresses.ts'
);

const SAMPLE = { subject: 'נושא', html: '<p>גוף</p>', text: 'גוף' };

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  if (!ok) console.log(`      התקבל: ${JSON.stringify(actual)}\n      צפוי:  ${JSON.stringify(expected)}`);
}

async function sent(options) {
  lastBody = null;
  await sendEmail('nobody@example.com', SAMPLE, options);
  return { from: lastBody.from, reply_to: lastBody.reply_to };
}

console.log('מטריצת From / Reply-To לפי תפקיד\n');

check('ברירת מחדל — אוטומטי, בלי Reply-To', await sent(undefined), {
  from: 'מכון קרן רא״ם <no-reply@kerenreem.org>',
  reply_to: undefined,
});

check("role: 'human' — contact@ בשני השדות", await sent({ role: 'human' }), {
  from: 'מכון קרן רא״ם <contact@kerenreem.org>',
  reply_to: ['contact@kerenreem.org'],
});

check('replyTo: null — בלי Reply-To, במפורש (איפוס סיסמה)', await sent({ replyTo: null }), {
  from: 'מכון קרן רא״ם <no-reply@kerenreem.org>',
  reply_to: undefined,
});

check(
  'replyTo מפורש על הודעה אוטומטית (הסיסמה שונתה, אישור פנייה, מסחר)',
  await sent({ replyTo: contactAddress() }),
  { from: 'מכון קרן רא״ם <no-reply@kerenreem.org>', reply_to: ['contact@kerenreem.org'] },
);

check(
  'replyTo של הפונה (התראת פנייה חדשה לצוות)',
  await sent({ replyTo: 'visitor@example.com' }),
  { from: 'מכון קרן רא״ם <no-reply@kerenreem.org>', reply_to: ['visitor@example.com'] },
);

check(
  'replyTo מפורש גובר על ברירת המחדל של human',
  await sent({ role: 'human', replyTo: 'other@example.com' }),
  { from: 'מכון קרן רא״ם <contact@kerenreem.org>', reply_to: ['other@example.com'] },
);

check('כתובת ריקה אינה הופכת ל-Reply-To ריק', await sent({ replyTo: '   ' }), {
  from: 'מכון קרן רא״ם <no-reply@kerenreem.org>',
  reply_to: undefined,
});

console.log('\nהגדרות סביבה');

process.env.EMAIL_FROM_AUTOMATED = 'בדיקה <auto@example.org>';
check('EMAIL_FROM_AUTOMATED גובר', (await sent(undefined)).from, 'בדיקה <auto@example.org>');
delete process.env.EMAIL_FROM_AUTOMATED;

process.env.COMMERCE_EMAIL_FROM = 'מיושן <legacy@example.org>';
check(
  'COMMERCE_EMAIL_FROM נתמך כשם מיושן',
  (await sent(undefined)).from,
  'מיושן <legacy@example.org>',
);
delete process.env.COMMERCE_EMAIL_FROM;

check('ברירת המחדל חוזרת אחרי הסרת המשתנה', (await sent(undefined)).from, 'מכון קרן רא״ם <no-reply@kerenreem.org>');

process.env.EMAIL_REPLY_TO_CONTACT = 'mail@example.org';
check('EMAIL_REPLY_TO_CONTACT גובר', (await sent({ role: 'human' })).reply_to, ['mail@example.org']);
delete process.env.EMAIL_REPLY_TO_CONTACT;

console.log('\nהתפר לקליטת תשובות');
check(
  'replyToForInquiry מחזיר כרגע contact@ נטו',
  replyToForInquiry('123'),
  'contact@kerenreem.org',
);
check('fromAddress עקבי עם המטריצה', [fromAddress('automated'), fromAddress('human')], [
  'מכון קרן רא״ם <no-reply@kerenreem.org>',
  'מכון קרן רא״ם <contact@kerenreem.org>',
]);

console.log('\nבלי ספק מוגדר');
delete process.env.RESEND_API_KEY;
const skipped = await sendEmail('nobody@example.com', SAMPLE);
check('אין מפתח → skipped ולא כישלון', [skipped.ok, skipped.skipped], [false, true]);

globalThis.fetch = original.fetch;

console.log(
  failed === 0
    ? '\nכל בדיקות מטריצת הדואר עברו.'
    : `\n${failed} בדיקות נכשלו.`,
);
process.exit(failed === 0 ? 0 : 1);
