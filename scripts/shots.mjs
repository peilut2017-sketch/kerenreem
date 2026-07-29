/**
 * צילומי מסך לסקירת עיצוב.
 * הרצה: node scripts/shots.mjs http://localhost:3000 [outDir]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const OUT = process.argv[3] ?? '/var/tmp/shots';

const PAGES = [
  ['home', '/'],
  ['books', '/books'],
  ['book', '/books/pnei-hamoadim'],
  ['events', '/events'],
  ['activities', '/activities'],
  ['authors', '/authors'],
  ['contact', '/contact'],
  ['about', '/about'],
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });

for (const [label, width, height] of [
  ['desktop', 1440, 1000],
  ['mobile', 390, 844],
]) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();

  for (const [name, url] of PAGES) {
    await page.goto(BASE + url, { waitUntil: 'networkidle' });
    // ההופעה בגלילה מופעלת ב-IntersectionObserver; גוללים עד הסוף כדי
    // שכל המקטעים יהיו גלויים בצילום, ואז חוזרים לראש.
    await page.evaluate(async () => {
      // גלילה מיידית: scroll-behavior: smooth גורם לצעדים לא להגיע ליעד,
      // וה-IntersectionObserver לא מופעל על המקטעים התחתונים.
      const root = document.documentElement;
      const previous = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      const step = Math.round(window.innerHeight * 0.8);
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo({ top: y, behavior: 'instant' });
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo({ top: 0, behavior: 'instant' });
      root.style.scrollBehavior = previous;
    });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${label}-${name}.png`, fullPage: true });
    console.log(`${label}/${name}`);
  }
  await context.close();
}

await browser.close();
