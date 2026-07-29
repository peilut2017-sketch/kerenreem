/**
 * בדיקה שטופס ההתחברות באמת שולח email ו-password ל-Supabase.
 *
 * מיירט את הבקשה ל-/auth/v1/token ובודק את גוף הבקשה, בשני תרחישים:
 *   1. הקלדה רגילה
 *   2. השלמה אוטומטית של מנהל סיסמאות — ערך מוצב ישירות על ה-DOM
 *      בלי אירוע ש-React מזהה. זה התרחיש שגרם ל-
 *      "validation_failed: missing email or phone".
 *
 * הרצה (עם NEXT_PUBLIC_SUPABASE_URL/ANON_KEY כלשהם בזמן build):
 *   node scripts/check-login.mjs http://localhost:3000
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });

let failures = 0;

async function attempt(label, fill) {
  const context = await browser.newContext();
  const page = await context.newPage();

  let body = null;
  await page.route('**/auth/v1/token**', async (route) => {
    try {
      body = JSON.parse(route.request().postData() ?? '{}');
    } catch {
      body = { parseError: route.request().postData() };
    }
    // תשובה מדומה — הבדיקה היא על מה שנשלח, לא על מה שחוזר
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'invalid_grant', error_description: 'stub' }),
    });
  });

  await page.goto(BASE + '/admin/login', { waitUntil: 'networkidle' });
  await fill(page);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(700);

  const ok = body?.email === 'admin@kerenreem.org.il' && body?.password === 's3cret-pass';
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  console.log(`    נשלח: email=${JSON.stringify(body?.email)} password=${body?.password ? '(קיים)' : JSON.stringify(body?.password)}`);
  if (!ok) failures += 1;

  await context.close();
}

// 1. הקלדה רגילה
await attempt('הקלדה רגילה', async (page) => {
  await page.fill('input[type="email"]', 'admin@kerenreem.org.il');
  await page.fill('input[type="password"]', 's3cret-pass');
});

// 2. השלמה אוטומטית: הצבת value ישירות, בלי אירוע input
await attempt('השלמה אוטומטית של מנהל סיסמאות', async (page) => {
  await page.evaluate(() => {
    const email = document.querySelector('input[type="email"]');
    const password = document.querySelector('input[type="password"]');
    // בדיוק מה שמנהל סיסמאות עושה: כתיבה ישירה לתכונה,
    // בלי dispatchEvent שגורם ל-React לעדכן state.
    email.value = 'admin@kerenreem.org.il';
    password.value = 's3cret-pass';
  });
});

await browser.close();
console.log(failures === 0 ? '\nטופס ההתחברות שולח את הפרטים כראוי.' : `\n${failures} תרחישים נכשלו.`);
process.exit(failures === 0 ? 0 : 1);
