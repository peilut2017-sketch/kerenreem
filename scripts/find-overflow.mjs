/**
 * מאתר את האלמנטים שגורמים לגלילה אופקית.
 * הרצה: node scripts/find-overflow.mjs http://localhost:3000 [path]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const PATH = process.argv[3] ?? '/';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });

for (const width of [1280, 390]) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE + PATH, { waitUntil: 'networkidle' });

  const offenders = await page.evaluate((vw) => {
    const out = [];
    const rtl = getComputedStyle(document.documentElement).direction === 'rtl';
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // ב-RTL הגלישה יוצאת שמאלה (ערך שלילי), ב-LTR ימינה
      const over = rtl ? -Math.min(0, r.left) : Math.max(0, r.right - vw);
      if (over > 1) {
        out.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className?.toString?.() ?? '').slice(0, 110),
          over: Math.round(over),
          w: Math.round(r.width),
        });
      }
    }
    // רק המפרים העמוקים ביותר — הורים יורשים את הגלישה מהילדים
    return out.slice(-8);
  }, width);

  console.log(`\n=== ${width}px — ${PATH} ===`);
  if (offenders.length === 0) console.log('  אין גלישה');
  for (const o of offenders) console.log(`  +${o.over}px  <${o.tag}> w=${o.w}  ${o.cls}`);

  await context.close();
}

await browser.close();
