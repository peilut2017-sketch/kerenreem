// בדיקת הסיווג של האנליטיקה העצמאית (src/lib/analytics/classify.ts) —
// פונקציות טהורות, ללא מסד. הרצה: npm run check:analytics
import assert from 'node:assert/strict';
import {
  classifyChannel,
  cleanPath,
  deviceFromUserAgent,
  isBotUserAgent,
  normalizeHost,
} from '../src/lib/analytics/classify.ts';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log('סיווג ערוצים');
check('בלי מפנה — ישיר', () => assert.equal(classifyChannel({ referrerHost: null, utmSource: null, utmMedium: null }), 'direct'));
check('גוגל — חיפוש', () => assert.equal(classifyChannel({ referrerHost: 'google.co.il', utmSource: null, utmMedium: null }), 'organic_search'));
check('פייסבוק — רשת חברתית', () => assert.equal(classifyChannel({ referrerHost: 'm.facebook.com', utmSource: null, utmMedium: null }), 'social'));
check('אתר אחר — מפנה', () => assert.equal(classifyChannel({ referrerHost: 'example.org', utmSource: null, utmMedium: null }), 'referral'));
check('utm_medium=email גובר על המפנה', () => assert.equal(classifyChannel({ referrerHost: 'mail.google.com', utmSource: 'news', utmMedium: 'email' }), 'email'));
check('utm_medium=cpc — ממומן', () => assert.equal(classifyChannel({ referrerHost: 'google.com', utmSource: 'g', utmMedium: 'cpc' }), 'paid'));
check('utm בלי medium מוכר — קמפיין', () => assert.equal(classifyChannel({ referrerHost: null, utmSource: 'flyer', utmMedium: null }), 'campaign'));

console.log('בוטים ומכשירים');
check('Googlebot', () => assert.equal(isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)'), true));
check('דפדפן ללא ראש (הניטור הסינתטי)', () => assert.equal(isBotUserAgent('Mozilla/5.0 HeadlessChrome/120'), true));
check('חסר UA נחשב בוט', () => assert.equal(isBotUserAgent(null), true));
check('Safari באייפון אינו בוט', () => assert.equal(isBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Safari/604.1'), false));
check('אייפון — נייד', () => assert.equal(deviceFromUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), 'mobile'));
check('אייפד — טאבלט', () => assert.equal(deviceFromUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0)'), 'tablet'));
check('אנדרואיד בלי Mobile — טאבלט', () => assert.equal(deviceFromUserAgent('Mozilla/5.0 (Linux; Android 13; SM-X700)'), 'tablet'));
check('Windows — מחשב', () => assert.equal(deviceFromUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'desktop'));

console.log('נתיבים ומתחמים');
check('נתיב עברי מקודד מפוענח', () => assert.equal(cleanPath('/books/%D7%A1%D7%A4%D7%A8'), '/books/ספר'));
check('query ו-hash נחתכים', () => assert.equal(cleanPath('/books?q=1#x'), '/books'));
check('לוכסן סופי נחתך', () => assert.equal(cleanPath('/events/'), '/events'));
check('נתיבי admin/api נדחים', () => {
  assert.equal(cleanPath('/admin/books'), null);
  assert.equal(cleanPath('/api/x'), null);
});
check('נתיב שאינו מתחיל ב-/ נדחה', () => assert.equal(cleanPath('books'), null));
check('www מוסר מהמתחם', () => assert.equal(normalizeHost('WWW.Example.com:443'), 'example.com'));
check('מתחם פסול נדחה', () => assert.equal(normalizeHost('not a host'), null));

console.log(`\nכל ${passed} בדיקות האנליטיקה עברו.`);
