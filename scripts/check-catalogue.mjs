/**
 * בדיקת עמוד הספרים במצבים הפתוחים שלו.
 *
 * axe על טעינת העמוד בודק רק את מצב המנוחה. המגירה והצעות החיפוש הם
 * בדיוק החלקים שבהם נגישות נשברת — דיאלוג מודאלי בלי לכידת מיקוד, או
 * רשימת הצעות בלי קשר ARIA לשדה — ושניהם אינם קיימים על המסך עד שפותחים
 * אותם. לכן הבדיקה הזו פותחת אותם ורק אז בודקת.
 *
 * הרצה: node scripts/check-catalogue.mjs http://localhost:3400
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const BASE = process.argv[2] ?? 'http://localhost:3400';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

async function axe(label) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  check(`axe: ${label}`, violations.length === 0, `${violations.length} ממצאים`);
  for (const violation of violations) {
    console.log(`    [${violation.impact}] ${violation.id}: ${violation.help}`);
  }
}

await page.goto(`${BASE}/books`, { waitUntil: 'networkidle' });

/* --- מצב מנוחה --- */
await axe('עמוד הספרים');

/* --- שורת החיפוש --- */
const search = page.getByRole('combobox', { name: 'חיפוש בקטלוג' });
check('שורת החיפוש היא combobox', (await search.count()) === 1);

await search.click();
await page.waitForTimeout(250);
const expanded = await search.getAttribute('aria-expanded');
check('הרשימה נפתחת במיקוד', expanded === 'true', `aria-expanded=${expanded}`);
await axe('הצעות פתוחות');

// חץ למטה מסמן פריט בלי להזיז את המיקוד מהשדה
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(120);
const activeDescendant = await search.getAttribute('aria-activedescendant');
const focusStillInput = await page.evaluate(
  () => document.activeElement?.getAttribute('role') === 'combobox',
);
check('חץ מסמן הצעה', Boolean(activeDescendant), activeDescendant ?? 'ללא');
check('המיקוד נשאר בשדה החיפוש', focusStillInput);

await page.keyboard.press('Escape');
await page.waitForTimeout(150);
check('Escape סוגר את ההצעות', (await search.getAttribute('aria-expanded')) === 'false');

/* --- מגירת הסינון --- */
const filterButton = page.getByRole('button', { name: /^סינון/ });
await filterButton.click();
await page.waitForTimeout(350);

const dialog = page.getByRole('dialog');
check('המגירה נפתחת כדיאלוג', (await dialog.count()) === 1);
check('המגירה מודאלית', (await dialog.getAttribute('aria-modal')) === 'true');
await axe('מגירת סינון פתוחה');

// המיקוד חייב להישאר בתוך המגירה
const trapped = await page.evaluate(async () => {
  const panel = document.querySelector('[role="dialog"]');
  for (let i = 0; i < 30; i += 1) {
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    document.dispatchEvent(event);
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (document.activeElement && !panel?.contains(document.activeElement)) return false;
  }
  return true;
});
check('המיקוד נלכד בתוך המגירה', trapped);

await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('Escape סוגר את המגירה', (await page.getByRole('dialog').count()) === 0);

const focusReturned = await page.evaluate(
  () => document.activeElement?.textContent?.includes('סינון') ?? false,
);
check('המיקוד חוזר לכפתור הסינון', focusReturned);

/* --- מועדפים --- */
// אחיזה באלמנט עצמו ולא בשאילתה: שם הכפתור משתנה אחרי הלחיצה
// ("הוספת… למועדפים" הופך ל"הסרת… מהמועדפים"), ושאילתה חוזרת הייתה
// מוצאת כרטיס אחר לגמרי ומדווחת שהמצב לא השתנה.
const heart = await page.locator('article button[aria-pressed]').first().elementHandle();
if (heart) {
  const before = await heart.getAttribute('aria-pressed');
  await heart.click();
  await page.waitForTimeout(300);
  const after = await heart.getAttribute('aria-pressed');
  check('מועדף מתחלף ומוסר ב-aria-pressed', before !== after, `${before} → ${after}`);

  const persisted = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem('kr:favourites') ?? '[]').length,
  );
  check('המועדף נשמר מקומית', persisted > 0, `${persisted} פריטים`);
} else {
  console.log('  ℹ אין ספרים בקטלוג — דילוג על בדיקת המועדפים');
}

/* --- סינון מעדכן את הכתובת --- */
await search.fill('בדיקה שאין לה תוצאות כלל');
await page.waitForTimeout(600);
check('הכתובת משקפת את החיפוש', page.url().includes('q='), page.url().split('?')[1] ?? '');

const emptyVisible = await page.getByText(/לא נמצאו|הקטלוג נמצא בהקמה/).count();
check('מצב ריק מוצג', emptyVisible > 0);

await browser.close();
console.log(failures === 0 ? '\nעמוד הספרים תקין.' : `\n${failures} בדיקות נכשלו.`);
process.exit(failures === 0 ? 0 : 1);
