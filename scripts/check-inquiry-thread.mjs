/**
 * בדיקת כתובת המענה החתומה והסרת הציטוט מתשובות צוות במייל.
 *
 * הרצה: node --experimental-strip-types scripts/check-inquiry-thread.mjs
 *
 * שתי הפונקציות האלה הן כל מה שמפריד בין "תשובה נקלטת לפנייה הנכונה"
 * לבין "מישהו מזריק מענה לפנייה זרה" (חתימה), ובין "הפונה מקבל את מה
 * שהצוות כתב" לבין "הפונה מקבל גם את כל ההודעה המקורית מצוטטת" (ציטוט).
 */
import { register } from 'node:module';

register(new URL('./resolve-server-only.mjs', import.meta.url));

const { inquiryReplyAddress, parseInquiryReplyAddress, stripQuotedReply, textToHtml, safeEqual } =
  await import('../src/lib/email/inquiry-thread.ts');

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

const SECRET = 'test-secret';
const ID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';

console.log('כתובת מענה חתומה');
const address = inquiryReplyAddress(ID, SECRET);
check('יוצרת כתובת על הדומיין', /^contact\+i[0-9a-f]{32}\.[0-9a-f]{12}@kerenreem\.org$/.test(address), true);
check('הלוקאל פארט קצר מ-64 תווים', address.split('@')[0].length <= 64, true);
check('הלוך ושוב מחזיר את המזהה', parseInquiryReplyAddress(address, SECRET), ID);
check('אותיות גדולות ושם תצוגה', parseInquiryReplyAddress(`צוות <${address.toUpperCase()}>`, SECRET), ID);
check('בלי סוד → כבוי', inquiryReplyAddress(ID, null), null);
check('מזהה שאינו UUID → null', inquiryReplyAddress('123', SECRET), null);
check('חתימה שגויה נדחית', parseInquiryReplyAddress(address.replace(/\.[0-9a-f]{12}@/, '.000000000000@'), SECRET), null);
check('סוד אחר נדחה', parseInquiryReplyAddress(address, 'other-secret'), null);
check('מזהה אחר עם אותה חתימה נדחה', parseInquiryReplyAddress(address.replace(/i[0-9a-f]{4}/, 'i0000'), SECRET), null);
check('contact@ נטו אינו כתובת פנייה', parseInquiryReplyAddress('contact@kerenreem.org', SECRET), null);
check('דומיין אחר נדחה', parseInquiryReplyAddress(address.replace('kerenreem.org', 'example.com'), SECRET), null);
check('safeEqual', [safeEqual('a', 'a'), safeEqual('a', 'b'), safeEqual('a', 'ab')], [true, false, false]);

console.log('\nהסרת ציטוט');
check('בלי ציטוט — כמות שהוא', stripQuotedReply('שלום,\nנשלח היום.\n\nתודה'), 'שלום,\nנשלח היום.\n\nתודה');
check(
  'ג׳ימייל באנגלית',
  stripQuotedReply('נשלח היום.\n\nOn Sun, Nov 8, 2026 at 10:00 AM Dana <noreply@kerenreem.org> wrote:\n> שאלה\n> עוד'),
  'נשלח היום.',
);
check(
  'ג׳ימייל באנגלית — שבירת שורה לפני wrote',
  stripQuotedReply('נשלח היום.\n\nOn Sun, Nov 8, 2026 at 10:00 AM Dana <noreply@kerenreem.org>\nwrote:\n> שאלה'),
  'נשלח היום.',
);
check(
  'ג׳ימייל בעברית עם סימני כיווניות',
  stripQuotedReply('נשלח היום.\n\n‫בתאריך יום א׳, 8 בנוב׳ 2026 ב-10:00 מאת Dana <noreply@kerenreem.org>:‬\n> שאלה'),
  'נשלח היום.',
);
check('Outlook', stripQuotedReply('נשלח.\n\n-----Original Message-----\nFrom: x\nSent: y\n\nשאלה'), 'נשלח.');
check('שורות ">" בלבד', stripQuotedReply('תשובה\n> ציטוט'), 'תשובה');
check('תשובה שהיא ציטוט בלבד → ריק', stripQuotedReply('> ציטוט\n> עוד'), '');
check('"On" בתחילת משפט רגיל לא נחתך', stripQuotedReply('On time delivery is guaranteed.\nתודה'), 'On time delivery is guaranteed.\nתודה');
check('"בתאריך" בתחילת משפט רגיל לא נחתך', stripQuotedReply('בתאריך 5 נשלח הספר אליכם.\nתודה'), 'בתאריך 5 נשלח הספר אליכם.\nתודה');
check('CRLF', stripQuotedReply('שלום\r\nעולם\r\n> ציטוט'), 'שלום\nעולם');

console.log('\nטקסט → HTML');
check('פסקאות ושבירת שורה', textToHtml('א\nב\n\nג'), '<p>א<br>ב</p><p>ג</p>');
check('בריחה מתגיות', textToHtml('<script>x</script> & y'), '<p>&lt;script&gt;x&lt;/script&gt; &amp; y</p>');

console.log(failed === 0 ? '\nכל בדיקות המענה במייל עברו.' : `\n${failed} בדיקות נכשלו.`);
process.exit(failed === 0 ? 0 : 1);
