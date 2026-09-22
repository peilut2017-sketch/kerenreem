#!/usr/bin/env node
/**
 * [1.40] בדיקת דפדפן אמיתי — פעם בשעה, דסקטופ ומובייל.
 *
 * למה זה נחוץ מעבר לבדיקות ה-HTTP: בדיקת blackbox מקבלת את ה-HTML
 * ומסתפקת בכך. היא אינה יודעת אם התמונות באמת נטענו, אם הגופן
 * הגיע, אם JavaScript קרס אחרי ההידרציה, או אם הפריסה נשברה
 * במובייל. באירוע האחרון נבדק ידנית "שהלוגו והכריכות מוצגים
 * בדסקטופ ובמובייל" — הבדיקה הזו עושה בדיוק את זה, אוטומטית.
 *
 * מה היא מאמתת בכל עמוד:
 *   • קוד תשובה 2xx ואין שגיאת 500 בגוף.
 *   • אין שגיאות JavaScript בקונסול ואין בקשות רשת שנכשלו.
 *   • הטקסט הצפוי קיים (עמוד שנטען אך ריק הוא כשל).
 *   • כל תמונה גלויה נטענה *בפועל* — naturalWidth > 0. זו הבדיקה
 *     שתופסת קובץ שנעלם מ-Storage: ה-HTML תקין, ה-img קיים,
 *     והתמונה לא שם.
 *   • גלילה עד התחתית, כדי שתמונות עצלות (lazy) ייטענו גם הן.
 *
 * הרצה:
 *   node monitoring/scripts/synthetic-browser.mjs --base https://www.kerenreem.org
 *
 * יציאה: 0 כשהכול עבר, 1 כשמשהו נכשל. הפלט JSON בשורה אחת ל-stdout,
 * כדי שמתזמן יוכל להזרים אותו הלאה.
 */

import { chromium, devices } from 'playwright';

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback;
};

const BASE = (argOf('base', process.env.MONITOR_BASE_URL ?? 'https://www.kerenreem.org')).replace(
  /\/+$/,
  '',
);
/** ספר עוגן — להחליף ב-slug של ספר שלא יימחק. */
const CANARY_BOOK = argOf('book', process.env.MONITOR_CANARY_BOOK ?? '');

/**
 * העמודים שנבדקים, והטקסט שחייב להופיע בכל אחד.
 * הטקסט נבחר כך שהוא *נעלם* כשהעמוד ריק — זו כל הנקודה.
 */
const PAGES = [
  { path: '/', mustContain: null, name: 'עמוד הבית' },
  { path: '/books', mustContain: null, name: 'קטלוג' },
  { path: '/authors', mustContain: null, name: 'מחברים' },
  { path: '/activities', mustContain: null, name: 'פעילויות' },
  { path: '/events', mustContain: null, name: 'אירועים' },
  { path: '/contact', mustContain: null, name: 'יצירת קשר' },
  { path: '/en', mustContain: null, name: 'עמוד הבית (אנגלית)' },
  ...(CANARY_BOOK
    ? [
        { path: `/books/${CANARY_BOOK}`, mustContain: null, name: 'עמוד ספר' },
        { path: `/en/books/${CANARY_BOOK}`, mustContain: null, name: 'עמוד ספר (אנגלית)' },
      ]
    : []),
];

/**
 * שגיאות קונסול שאינן מעידות על תקלה באתר: הרחבות דפדפן, חוסמי
 * פרסומות, ודיווחי מדיניות. בלי הסינון כל ריצה הייתה אדומה, וזה
 * גרוע מלא לבדוק בכלל.
 */
const IGNORED_CONSOLE = [
  /favicon/i,
  /ResizeObserver loop/i,
  /Content Security Policy.*report-only/i,
  /googletagmanager|google-analytics|gtag/i,
];

/** גלילה עד התחתית בצעדים — כדי שתמונות lazy ייטענו. */
async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    window.scrollTo(0, 0);
  });
  // שהות קצרה אחרי הגלילה: טעינת תמונה אינה מיידית גם אחרי שהיא נדרשה.
  await page.waitForTimeout(800);
}

/** כל תמונה גלויה שלא נטענה בפועל. */
async function brokenImages(page) {
  return page.evaluate(() =>
    Array.from(document.images)
      .filter((img) => {
        const rect = img.getBoundingClientRect();
        const visible = rect.width > 2 && rect.height > 2;
        // complete=true עם naturalWidth=0 פירושו: הדפדפן סיים לנסות,
        // וכשל. זה המצב של קובץ שנמחק מהאחסון.
        return visible && img.complete && img.naturalWidth === 0;
      })
      .map((img) => img.currentSrc || img.src)
      .slice(0, 10),
  );
}

async function checkPage(context, pageSpec, viewportName) {
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (IGNORED_CONSOLE.some((pattern) => pattern.test(text))) return;
    consoleErrors.push(text.slice(0, 300));
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (IGNORED_CONSOLE.some((pattern) => pattern.test(url))) return;
    failedRequests.push(`${request.failure()?.errorText ?? 'failed'} ${url.slice(0, 200)}`);
  });

  const started = Date.now();
  const problems = [];
  let status = 0;

  try {
    const response = await page.goto(`${BASE}${pageSpec.path}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    status = response?.status() ?? 0;
    if (!response || status >= 400) {
      problems.push(`HTTP ${status}`);
    }

    await scrollThrough(page);

    const bodyText = await page.evaluate(() => document.body.innerText);
    if (bodyText.trim().length < 200) {
      problems.push('גוף העמוד כמעט ריק');
    }
    if (/Application error|Internal Server Error/i.test(bodyText)) {
      problems.push('העמוד מציג שגיאת יישום');
    }
    if (pageSpec.mustContain && !bodyText.includes(pageSpec.mustContain)) {
      problems.push(`חסר הטקסט הצפוי: ${pageSpec.mustContain}`);
    }

    const broken = await brokenImages(page);
    if (broken.length > 0) {
      problems.push(`${broken.length} תמונות לא נטענו: ${broken.slice(0, 3).join(', ')}`);
    }

    // גלישה אופקית במובייל היא כשל נגישות, לא רק אסתטיקה.
    if (viewportName === 'mobile') {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (overflow > 4) problems.push(`גלישה אופקית של ${overflow}px`);
    }

    if (consoleErrors.length > 0) problems.push(`שגיאות קונסול: ${consoleErrors[0]}`);
    if (failedRequests.length > 0) problems.push(`בקשות שנכשלו: ${failedRequests[0]}`);
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  } finally {
    await page.close();
  }

  return {
    page: pageSpec.name,
    path: pageSpec.path,
    viewport: viewportName,
    status,
    durationMs: Date.now() - started,
    ok: problems.length === 0,
    problems,
  };
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const results = [];

  for (const [viewportName, deviceOptions] of [
    ['desktop', { viewport: { width: 1440, height: 900 } }],
    ['mobile', devices['iPhone 13']],
  ]) {
    const context = await browser.newContext({
      ...deviceOptions,
      locale: 'he-IL',
      // עוקף מטמון ה-CDN: בדיקה שמקבלת תשובה שמורה אינה בודקת את
      // המצב הנוכחי — וזו בדיוק הטעות שגרמה ל-500 שמור להיראות תקין.
      extraHTTPHeaders: { 'Cache-Control': 'no-cache', 'User-Agent-Note': 'kerenreem-monitor' },
    });
    for (const pageSpec of PAGES) {
      results.push(await checkPage(context, pageSpec, viewportName));
    }
    await context.close();
  }

  await browser.close();

  const failures = results.filter((result) => !result.ok);
  const output = {
    at: new Date().toISOString(),
    base: BASE,
    checked: results.length,
    failed: failures.length,
    results,
  };

  process.stdout.write(`${JSON.stringify(output)}\n`);

  if (failures.length > 0) {
    for (const failure of failures) {
      process.stderr.write(
        `✗ [${failure.viewport}] ${failure.page} (${failure.path}): ${failure.problems.join(' · ')}\n`,
      );
    }
    process.exit(1);
  }

  process.stderr.write(`✓ ${results.length} בדיקות עברו\n`);
}

main().catch((error) => {
  process.stderr.write(`בדיקת הדפדפן קרסה: ${error?.stack ?? error}\n`);
  process.exit(1);
});
