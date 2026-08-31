/**
 * מזהי הגופנים המובנים (ה-slug ב---font-<slug>) — מקור אחד.
 *
 * ללא תלות ב-next/font במכוון: sanitize.ts נטען גם ישירות ב-Node
 * (scripts/check-sanitize.mjs) ואינו יכול לייבא את fonts.ts (שמושך את
 * next/font/google). לפני האיחוד, רשימת הגופנים המותרים הופיעה שלוש
 * פעמים — ב-fonts.ts, ב-SITE_FONT_VALUE_PATTERN, וכביטוי מפורש
 * ב-sanitize.ts — כך שהוספת גופן והשמטת אחד מהם גרמו לגופן להיחתך בשקט
 * מהתוכן העשיר. שני הצרכנים גוזרים מכאן.
 *
 * ⚠ בהוספת גופן מובנה: להוסיף כאן *וגם* להגדיר את next/font ב-fonts.ts
 * (עם אותו --font-<slug>). check-sanitize.mjs מאמת שהביטוי נבנה מכאן.
 */
export const BUILTIN_FONT_SLUGS = [
  'assistant',
  'frank',
  'heebo',
  'rubik',
  'noto-hebrew',
  'david-libre',
  'secular-one',
  'alef',
  'suez',
  'bellefair',
] as const;

/**
 * ביטוי רגולרי לערך font-family מותר בתוכן עשיר: משתני הגופנים המובנים,
 * או גופן מותקן (custom_fonts, מיגרציה 47) עם slug באותיות קטנות/ספרות/מקף.
 */
export const FONT_FAMILY_VALUE_PATTERN = new RegExp(
  `^var\\(--font-(?:${BUILTIN_FONT_SLUGS.join('|')}|custom-[a-z0-9-]{1,40})\\)$`,
);
