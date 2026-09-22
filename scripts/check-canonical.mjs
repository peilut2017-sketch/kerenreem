#!/usr/bin/env node
/**
 * [1.40] שומר הכתובת הקנונית.
 *
 * למה הבדיקה הזו קיימת: sitemap.xml פרסם במשך תקופה את כתובת הפריסה
 * של Vercel (…​.vercel.app) במקום את הדומיין של המכון. שום דבר לא
 * נשבר — העמודים נטענו, התמונות הוצגו — ולכן איש לא שם לב. מה שכן
 * קרה: מנועי חיפוש ראו אתר כפול, וקישורים שנשלחו במייל הוציאו את
 * המקבלים מהדומיין הנכון. תקלה שקטה מהסוג שדורש בדיקה אוטומטית
 * דווקא משום שאינה כואבת.
 *
 * מה נבדק:
 *   1. ‏sitemap.xml — כל <loc> מצביע על הדומיין הקנוני.
 *   2. ‏robots.txt — שורת ה-Sitemap מצביעה על הדומיין הקנוני.
 *   3. עמודי מפתח — תג <link rel="canonical"> וכל ה-hreflang.
 *   4. ‏/api/health — מה האתר עצמו מדווח שכתובתו.
 *
 * הרצה מול ייצור:
 *   node scripts/check-canonical.mjs --base https://www.kerenreem.org
 *
 * הרצה מול שרת מקומי או תצוגה מקדימה, כשהכתובת שאליה פונים אינה
 * הכתובת שאמורה להתפרסם:
 *   node scripts/check-canonical.mjs --base http://127.0.0.1:3000 \
 *        --expect https://www.kerenreem.org
 *
 * שילוב: מריצים אותה אחרי כל פריסה (ואז היא תופסת הגדרת סביבה
 * שגויה לפני שגוגל רואה אותה), ופעם ביום מהמוניטור.
 */

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback;
};

const BASE = argOf('base', process.env.MONITOR_BASE_URL ?? 'https://www.kerenreem.org').replace(
  /\/+$/,
  '',
);
/**
 * ה-origin שכל כתובת ציבורית חייבת לשאת. ברירת המחדל היא זה שאליו
 * פונים — הנכון כשבודקים ייצור. ‎--expect מפריד בין השניים, כדי
 * שאפשר יהיה לבדוק בנייה מקומית או תצוגה מקדימה ועדיין לאמת שהיא
 * תפרסם את הדומיין הנכון כשתעלה.
 */
const EXPECTED_ORIGIN = new URL(
  argOf('expect', process.env.MONITOR_EXPECT_ORIGIN ?? BASE),
).origin;

const PAGES_TO_CHECK = ['/', '/books', '/authors', '/events', '/contact', '/en'];

const failures = [];
const notes = [];

function fail(message) {
  failures.push(message);
}

async function fetchText(path) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'kerenreem-canonical-check/1.0' },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} על ${path}`);
  return response.text();
}

/** כל ה-origin-ים הייחודיים שמופיעים בכתובות שנמצאו. */
function originsOf(urls) {
  const origins = new Set();
  for (const url of urls) {
    try {
      origins.add(new URL(url).origin);
    } catch {
      origins.add(`(כתובת לא תקינה: ${url})`);
    }
  }
  return [...origins];
}

async function checkSitemap() {
  const xml = await fetchText('/sitemap.xml');
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => match[1]);
  // גם hreflang בתוך ה-sitemap מצביע על כתובות, ובו התקלה זהה.
  const alternates = [...xml.matchAll(/hreflang="[^"]*"\s+href="([^"]+)"/g)].map((m) => m[1]);

  if (locs.length === 0) {
    fail('sitemap.xml אינו מכיל אף <loc> — ייתכן שהוא ריק או ששליפת הנתונים נכשלה');
    return;
  }

  const origins = originsOf([...locs, ...alternates]);
  const wrong = origins.filter((origin) => origin !== EXPECTED_ORIGIN);
  if (wrong.length > 0) {
    fail(`sitemap.xml מפרסם דומיינים שאינם הקנוני: ${wrong.join(', ')} (צפוי: ${EXPECTED_ORIGIN})`);
  } else {
    notes.push(`sitemap.xml: ${locs.length} כתובות, כולן על ${EXPECTED_ORIGIN}`);
  }
}

async function checkRobots() {
  const text = await fetchText('/robots.txt');
  const match = /^\s*Sitemap:\s*(\S+)/im.exec(text);
  if (!match) {
    fail('robots.txt אינו מפנה ל-sitemap כלל');
    return;
  }
  const origin = new URL(match[1]).origin;
  if (origin !== EXPECTED_ORIGIN) {
    fail(`robots.txt מפנה ל-sitemap בדומיין ${origin} (צפוי: ${EXPECTED_ORIGIN})`);
  } else {
    notes.push(`robots.txt: מפנה ל-${match[1]}`);
  }
}

async function checkPageCanonical(path) {
  const html = await fetchText(path);

  const canonical = /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i.exec(html)?.[1];
  if (!canonical) {
    fail(`${path}: אין תג canonical`);
  } else if (new URL(canonical, BASE).origin !== EXPECTED_ORIGIN) {
    fail(`${path}: canonical מצביע על ${canonical}`);
  }

  const alternates = [...html.matchAll(/<link[^>]+hreflang="[^"]*"[^>]+href="([^"]+)"/gi)].map(
    (match) => match[1],
  );
  const wrong = originsOf(alternates).filter((origin) => origin !== EXPECTED_ORIGIN);
  if (wrong.length > 0) {
    fail(`${path}: hreflang מצביע על ${wrong.join(', ')}`);
  }

  // ‏og:url נכנס לכרטיסיות שיתוף ברשתות — אותה תקלה, חשיפה אחרת.
  const ogUrl = /<meta[^>]+property="og:url"[^>]+content="([^"]+)"/i.exec(html)?.[1];
  if (ogUrl && new URL(ogUrl, BASE).origin !== EXPECTED_ORIGIN) {
    fail(`${path}: og:url מצביע על ${ogUrl}`);
  }
}

async function checkHealthReport() {
  try {
    const response = await fetch(`${BASE}/api/health`, { cache: 'no-store' });
    if (!response.ok) {
      notes.push(`/api/health החזיר ${response.status} — דילוג על הבדיקה הזו`);
      return;
    }
    const data = await response.json();
    if (data.canonicalUrl && data.canonicalUrl !== EXPECTED_ORIGIN) {
      fail(`האתר מדווח שכתובתו הקנונית היא ${data.canonicalUrl} (צפוי: ${EXPECTED_ORIGIN})`);
    }
    if (data.canonicalOverridden) {
      // לא כשל: המנגנון עשה בדיוק את עבודתו. אבל ההגדרה עדיין שגויה
      // וראוי לתקן אותה במקור, לא להישען על רשת הביטחון.
      notes.push(
        `⚠ NEXT_PUBLIC_SITE_URL אינו תקין (${data.canonicalReason}) — האתר נופל חזרה ל-${data.canonicalUrl}. יש לתקן בהגדרות הסביבה.`,
      );
    }
  } catch (error) {
    notes.push(`/api/health לא נבדק: ${error.message}`);
  }
}

async function main() {
  process.stderr.write(
    `בדיקת כתובת קנונית מול ${BASE}` +
      (EXPECTED_ORIGIN === new URL(BASE).origin ? '' : ` (צפוי: ${EXPECTED_ORIGIN})`) +
      '\n',
  );

  const tasks = [
    checkSitemap(),
    checkRobots(),
    checkHealthReport(),
    ...PAGES_TO_CHECK.map((path) => checkPageCanonical(path)),
  ];

  const settled = await Promise.allSettled(tasks);
  for (const result of settled) {
    if (result.status === 'rejected') fail(String(result.reason?.message ?? result.reason));
  }

  for (const note of notes) process.stderr.write(`  ${note}\n`);

  if (failures.length > 0) {
    process.stderr.write('\nנכשל:\n');
    for (const failure of failures) process.stderr.write(`  ✗ ${failure}\n`);
    process.exit(1);
  }

  process.stderr.write('✓ כל הכתובות הציבוריות מצביעות על הדומיין הקנוני\n');
}

main().catch((error) => {
  process.stderr.write(`הבדיקה קרסה: ${error?.stack ?? error}\n`);
  process.exit(1);
});
