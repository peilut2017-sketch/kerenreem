/**
 * בדיקת מעקב הצפייה בדואר: הזרקת הפיקסל, ה-GIF, ונקודת הקצה הציבורית.
 *
 * הרצה: node --experimental-strip-types scripts/check-email-tracking.mjs
 *
 * נקודת הקצה היא הדבר היחיד בכל המערכת שנגיש ללא אימות ומשנה מצב, ולכן
 * הבדיקה העיקרית היא שהיא לעולם אינה נכשלת ואינה מחזירה אחרת מ-GIF —
 * לא למזהה שגוי, לא כשהמסד לא זמין.
 */
import { register } from 'node:module';

register(new URL('./resolve-server-only.mjs', import.meta.url));
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { injectTrackingPixel, trackingPixelUrl, isTrackingId, TRANSPARENT_GIF } = await import(
  '../src/lib/email/tracking.ts'
);
const { GET } = await import('../src/app/api/email/open/[id]/route.ts');

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

const ID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';
const URL_ = trackingPixelUrl('https://www.kerenreem.org.il/', ID);

console.log('פיקסל');
check('כתובת בלי לוכסן כפול', URL_, `https://www.kerenreem.org.il/api/email/open/${ID}.gif`);
const withBody = injectTrackingPixel('<html><body><p>שלום</p></body></html>', URL_);
check('לפני </body>', withBody.indexOf('<img') < withBody.indexOf('</body>') && withBody.includes(URL_), true);
check('בלי </body> — בסוף', injectTrackingPixel('<p>x</p>', URL_).endsWith('/>'), true);
check('מזהה תקין / שגוי', [isTrackingId(ID), isTrackingId('abc'), isTrackingId(`${ID}x`)], [true, false, false]);
check('GIF אמיתי', new TextDecoder().decode(TRANSPARENT_GIF.slice(0, 6)), 'GIF89a');

console.log('\nנקודת הקצה');
for (const [label, id] of [
  ['מזהה תקין (בלי מסד)', `${ID}.gif`],
  ['מזהה שגוי', 'not-an-id.gif'],
  ['בלי סיומת', ID],
]) {
  const response = await GET(new Request('http://x/'), { params: Promise.resolve({ id }) });
  check(
    `${label} → 200 + gif + no-store`,
    [response.status, response.headers.get('content-type'), /no-store/.test(response.headers.get('cache-control') ?? '')],
    [200, 'image/gif', true],
  );
}

console.log(failed === 0 ? '\nכל בדיקות המעקב עברו.' : `\n${failed} בדיקות נכשלו.`);
process.exit(failed === 0 ? 0 : 1);
