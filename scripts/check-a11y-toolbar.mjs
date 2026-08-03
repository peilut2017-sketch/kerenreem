/**
 * בדיקה תפקודית לסרגל הנגישות: שההעדפות אכן מוחלות, נשמרות, ושורדות
 * טעינה מחדש בלי הבזק של ברירת המחדל.
 *
 * הרצה: node scripts/check-a11y-toolbar.mjs [http://localhost:3000]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

let failures = 0;
const check = (label, condition) => {
  console.log(`${condition ? '✓' : '✗'} ${label}`);
  if (!condition) failures += 1;
};

await page.goto(BASE + '/', { waitUntil: 'networkidle' });

// פתיחת הסרגל
await page.click('[aria-label="פתיחת סרגל נגישות"]');
check('הלוח נפתח', await page.locator('div[role="dialog"]').isVisible());

// הפעלת ניגודיות גבוהה
await page.click('button:has-text("ניגודיות גבוהה")');
check(
  'ניגודיות גבוהה מסומנת על <html>',
  (await page.getAttribute('html', 'data-a11y-contrast')) === 'on',
);

// הגדלת טקסט
const before = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue('--a11y-scale').trim(),
);
await page.click('button[aria-label="הגדלה"]');
const after = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue('--a11y-scale').trim(),
);
check(`הגדלת טקסט (${before || '1'} → ${after})`, Number(after) > Number(before || 1));

// ההעדפות שורדות טעינה מחדש, ומוחלות עוד לפני הצביעה הראשונה
await page.reload({ waitUntil: 'commit' });
check(
  'ההעדפה הוחלה כבר בטעינה (בלי הבזק ברירת מחדל)',
  (await page.getAttribute('html', 'data-a11y-contrast')) === 'on',
);

// המתגים בלוח משקפים את המצב השמור אחרי הטעינה
await page.waitForLoadState('networkidle');
await page.click('[aria-label="פתיחת סרגל נגישות"]');
check(
  'המתג בלוח מציג "פעיל" אחרי טעינה מחדש',
  (await page.getAttribute('button:has-text("ניגודיות גבוהה")', 'aria-pressed')) === 'true',
);

// איפוס
await page.click('button:has-text("איפוס הגדרות")');
check('איפוס מסיר את הסימון', (await page.getAttribute('html', 'data-a11y-contrast')) === null);

// סגירה במקלדת והחזרת המיקוד — דרישת ניווט מקלדת
await page.click('[aria-label="פתיחת סרגל נגישות"]');
await page.keyboard.press('Escape');
check('Escape סוגר את הלוח', (await page.locator('div[role="dialog"]').count()) === 0);
check(
  'המיקוד חוזר לכפתור הפותח',
  await page.evaluate(
    () => document.activeElement?.getAttribute('aria-label') === 'פתיחת סרגל נגישות',
  ),
);

await browser.close();
console.log(failures === 0 ? '\nהסרגל תקין.' : `\n${failures} בדיקות נכשלו.`);
process.exit(failures === 0 ? 0 : 1);
