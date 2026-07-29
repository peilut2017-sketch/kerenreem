/**
 * בדיקת נגישות אוטומטית (axe-core) + בדיקת גלישה אופקית.
 *
 * הרצה:
 *   npm run build && npm start &
 *   node scripts/check-a11y.mjs [http://localhost:3000]
 *
 * ⚠ בדיקה אוטומטית מזהה כ-30%–40% מכשלי הנגישות בלבד. היא אינה מחליפה
 *   בדיקה ידנית עם קורא מסך וניווט מקלדת, שנדרשת לעמידה בתקן 5568.
 *   הממצאים כאן הם רצפה, לא תקרה.
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';

const ROUTES = [
  '/',
  '/books',
  '/authors',
  '/activities',
  '/events',
  '/about',
  '/donate',
  '/contact',
  '/terms',
  '/privacy',
  '/accessibility',
  '/en',
  '/admin/login',
];

// תקן ישראלי 5568 מבוסס על WCAG 2.1 ברמה AA
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const VIEWPORTS = [
  { name: 'שולחני', width: 1280, height: 900 },
  { name: 'נייד', width: 390, height: 844 },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
let violationCount = 0;
let overflowCount = 0;

for (const viewport of VIEWPORTS) {
  // axe-core דורש context מפורש ולא browser.newPage()
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();
  console.log(`\n=== ${viewport.name} (${viewport.width}px) ===`);

  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });

    // גלישה אופקית שוברת קריאה בזום ובמסך צר — כשל WCAG 1.4.10
    const [scrollWidth, innerWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    if (scrollWidth > innerWidth + 1) {
      overflowCount += 1;
      console.log(`  ✗ ${route} — גלישה אופקית (${scrollWidth}px ברוחב ${innerWidth}px)`);
    }

    const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();

    if (violations.length === 0) {
      console.log(`  ✓ ${route}`);
      continue;
    }

    console.log(`  ✗ ${route}`);
    for (const violation of violations) {
      violationCount += violation.nodes.length;
      console.log(`      [${violation.impact}] ${violation.id}: ${violation.help}`);
      for (const node of violation.nodes.slice(0, 3)) {
        console.log(`        ${node.target.join(' ')}`);
      }
      if (violation.nodes.length > 3) {
        console.log(`        ... ועוד ${violation.nodes.length - 3}`);
      }
    }
  }

  // רכיבים אינטראקטיביים אינם קיימים ב-DOM עד שנפתחים, ולכן סריקה של
  // העמוד במצב מנוחה לעולם לא תבדוק אותם.
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  const widgets = [
    ['סרגל נגישות', 'button[aria-label="פתיחת סרגל נגישות"]'],
    ...(viewport.width < 1024 ? [['תפריט נייד', 'button[aria-controls="mobile-nav-panel"]']] : []),
  ];

  for (const [name, selector] of widgets) {
    const trigger = page.locator(selector).first();
    if ((await trigger.count()) === 0) {
      console.log(`  ? ${name} — לא נמצא כפתור פתיחה (${selector})`);
      continue;
    }
    await trigger.click();
    await page.waitForTimeout(150);

    const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    if (violations.length === 0) {
      console.log(`  ✓ ${name} (פתוח)`);
    } else {
      console.log(`  ✗ ${name} (פתוח)`);
      for (const violation of violations) {
        violationCount += violation.nodes.length;
        console.log(`      [${violation.impact}] ${violation.id}: ${violation.help}`);
        for (const node of violation.nodes.slice(0, 3)) {
          console.log(`        ${node.target.join(' ')}`);
        }
      }
    }
    await page.keyboard.press('Escape');
  }

  await context.close();
}

await browser.close();

console.log(
  `\nסיכום: ${violationCount} ממצאי נגישות, ${overflowCount} עמודים עם גלישה אופקית.`,
);
console.log('זכרו: יש להשלים בבדיקה ידנית עם קורא מסך ובניווט מקלדת בלבד.');

process.exit(violationCount + overflowCount === 0 ? 0 : 1);
