/**
 * מוודא שהמשטחים הצפים באמת צפים.
 *
 * כלל CSS לא-משוכב יכול לדרוס את position:sticky/fixed של Tailwind בלי
 * שום שגיאה — הכותרת פשוט מפסיקה להידבק וסרגל הנגישות נעלם בגלילה.
 * axe לא תופס את זה, ולכן הבדיקה הזו קיימת.
 *
 * הרצה: node scripts/check-layering.mjs http://localhost:3000
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

await page.goto(BASE + '/', { waitUntil: 'networkidle' });

const headerPos = await page.evaluate(
  () => getComputedStyle(document.querySelector('header')).position,
);
check('הכותרת דביקה', headerPos === 'sticky', `position: ${headerPos}`);

const barPos = await page.evaluate(() => {
  const el = document.querySelector('[aria-label="פתיחת סרגל נגישות"]')?.closest('div');
  return el ? getComputedStyle(el).position : 'לא נמצא';
});
check('סרגל הנגישות צף', barPos === 'fixed', `position: ${barPos}`);

// גלילה: הכותרת חייבת להישאר בראש החלון
await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }));
await page.waitForTimeout(400);
const headerTop = await page.evaluate(
  () => Math.round(document.querySelector('header').getBoundingClientRect().top),
);
check('הכותרת נשארת בראש אחרי גלילה', headerTop >= 0 && headerTop < 40, `top: ${headerTop}px`);

const barVisible = await page.evaluate(() => {
  const el = document.querySelector('[aria-label="פתיחת סרגל נגישות"]');
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.bottom <= window.innerHeight + 1;
});
check('סרגל הנגישות נראה אחרי גלילה', barVisible);

// הזכוכית באמת מטשטשת
const blur = await page.evaluate(() => {
  const el = document.querySelector('header .glass');
  return el ? getComputedStyle(el).backdropFilter || getComputedStyle(el).webkitBackdropFilter : '';
});
check('הכותרת מטשטשת את מה שמתחתיה', /blur/.test(blur), blur || 'ללא');

await browser.close();
console.log(failures === 0 ? '\nהמשטחים הצפים תקינים.' : `\n${failures} בדיקות נכשלו.`);
process.exit(failures === 0 ? 0 : 1);
