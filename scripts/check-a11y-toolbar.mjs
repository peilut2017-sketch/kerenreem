/**
 * בדיקה תפקודית לסרגל הנגישות: שההעדפות אכן מוחלות, נשמרות, ושורדות
 * טעינה מחדש בלי הבזק של ברירת המחדל — ושאיפוס מנקה גם את העדפות האתר.
 *
 * הבדיקה נכתבת מול ה-DOM האמיתי של חבילת accessibility (‎._access-menu‎,
 * ‎._menu-reset-btn‎, ‎data-access-action‎), לא מול role="dialog"/aria-pressed
 * שהחבילה אינה מספקת. הלחיצות על פריטי התפריט נעשות ב-DOM ישיר (evaluate)
 * ולא ב-page.click: פריטי התפריט של החבילה חופפים בפריסת headless וחוסמים
 * pointer, והבדיקה כאן על *ההתנהגות* (האם ההעדפה חלה/נמחקה), לא על hit-testing.
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

/**
 * לחיצה אטומית על כפתור בתפריט החבילה לפי טקסט או data-access-action.
 *
 * dispatchEvent עם detail:1 ולא element.click(): המאזינים של החבילה
 * מסננים ‎evt.detail === 0‎ (הדרך שלהם להתעלם מלחיצות תוכנה שאינן מהעכבר),
 * ו-‎.click()‎ מייצר detail:0 — כך שהוא לא היה מפעיל כלום. detail:1 מדמה
 * לחיצת עכבר אמיתית ובכל זאת נשאר אטומי (עוקף את חפיפת הפריסה ב-headless).
 */
async function clickMenu(match) {
  await page.evaluate((m) => {
    const buttons = [...document.querySelectorAll('._access-menu button')];
    const target = buttons.find(
      (b) => b.getAttribute('data-access-action') === m || (b.textContent || '').includes(m),
    );
    target?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  }, match);
  await page.waitForTimeout(250);
}

const menuOpen = () =>
  page.evaluate(() => {
    const menu = document.querySelector('._access-menu');
    return Boolean(menu) && !menu.classList.contains('close');
  });

/**
 * פתיחת כפתור הנגישות ב-dispatch ולא page.click: לכפתור יש מעבר box-shadow
 * ב-hover, ו-page.click ממתין ל"יציבות" האלמנט (סוף המעבר) — מה שנתקע.
 * ה-detail:1 מדמה לחיצת עכבר אמיתית, שהמאזין של החבילה דורש.
 */
async function openWidget() {
  await page.evaluate(() =>
    document.querySelector('._access-icon')?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })),
  );
}

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200); // ייבוא דינמי של החבילה

// פתיחת הסרגל — התפריט הוא ._access-menu (מאבד את המחלקה .close בפתיחה)
await openWidget();
await page.waitForTimeout(300);
check('הלוח נפתח', await menuOpen());

// הפעלת ניגודיות גבוהה — customFunction של האתר, מסמן data-a11y-contrast
await clickMenu('ניגודיות גבוהה');
check('ניגודיות גבוהה מסומנת על <html>', (await page.getAttribute('html', 'data-a11y-contrast')) === 'on');

// הגדלת טקסט — מודול increaseText של החבילה, מגדיל את גופן ה-body בפועל
const beforeFont = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
await clickMenu('increaseText');
const afterFont = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
check(`הגדלת טקסט (${beforeFont}px → ${afterFont}px)`, afterFont > beforeFont);

// ההעדפה שורדת טעינה מחדש, ומוחלת עוד לפני הצביעה הראשונה (A11Y_INIT_SCRIPT)
await page.reload({ waitUntil: 'commit' });
check(
  'ההעדפה הוחלה כבר בטעינה (בלי הבזק ברירת מחדל)',
  (await page.getAttribute('html', 'data-a11y-contrast')) === 'on',
);

// איפוס מנקה גם את העדפות האתר, לא רק את מודולי החבילה — הבאג שתוקן:
// resetAll של החבילה אינו יודע על ה-customFunctions שלנו, ולכן חיברנו
// אליו את resetSitePreferences (ראו AccessibilityWidget).
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1200);
await openWidget();
await page.waitForTimeout(300);
await page.evaluate(() =>
  document
    .querySelector('._menu-reset-btn')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })),
);
await page.waitForTimeout(300);
check('איפוס מנקה את ניגודיות האתר', (await page.getAttribute('html', 'data-a11y-contrast')) === null);

// סגירה במקלדת והחזרת המיקוד — דרישת ניווט מקלדת
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('Escape סוגר את הלוח', !(await menuOpen()));
check(
  'המיקוד חוזר לכפתור הפותח',
  await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'פתיחת סרגל נגישות'),
);

await browser.close();
console.log(failures === 0 ? '\nהסרגל תקין.' : `\n${failures} בדיקות נכשלו.`);
process.exit(failures === 0 ? 0 : 1);
