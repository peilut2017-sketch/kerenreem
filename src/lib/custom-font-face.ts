import { isProjectStorageUrl, toCdnUrl } from './image-src';
import type { CustomFont } from './supabase/types';

/**
 * [1.38] תיאור ‎@font-face בטוח לגופן מותקן (custom_fonts) — מקור אחד
 * לשני הצרכנים: הזרקת הגופנים הפעילים לאתר (CustomFontsStyle) והתצוגה
 * המקדימה בניהול (FontsManager), שמציגה גם גופנים כבויים ולכן אינה
 * יכולה להסתמך על המשתנים שה-layout מזריק.
 *
 * בטיחות ה-CSS (זהה בשני המקומות, ולכן כאן): ה-slug מאומת ([a-z0-9-]
 * בלבד), כתובת הקובץ חייבת להיות באחסון הפרויקט/CDN אחרי יישור
 * (toCdnUrl — כתובת מלפני מעבר ספק אחסון מיושרת לבסיס הנוכחי), ואסור
 * שיהיו בה תווים שסוגרים url('…'). כתובת שאינה עומדת בכללים מחזירה
 * null — הצרכן מדלג, בלי דרך להזריק CSS חופשי דרך שורת גופן.
 */

const SLUG_PATTERN = /^[a-z0-9-]{1,40}$/;

export interface CustomFontFace {
  slug: string;
  /** שם המשפחה שה-@font-face מגדיר — ייחודי לפי קידומת + slug. */
  family: string;
  url: string;
  format: string;
}

export function fontFormat(url: string): string {
  if (url.endsWith('.woff2')) return 'woff2';
  if (url.endsWith('.woff')) return 'woff';
  if (url.endsWith('.otf')) return 'opentype';
  return 'truetype';
}

export function customFontFace(
  font: Pick<CustomFont, 'slug' | 'font_url'>,
  familyPrefix = 'kr-font',
): CustomFontFace | null {
  const url = toCdnUrl(font.font_url);
  if (!SLUG_PATTERN.test(font.slug) || !isProjectStorageUrl(url) || /['"\\)]/.test(url)) return null;
  return { slug: font.slug, family: `${familyPrefix}-${font.slug}`, url, format: fontFormat(url) };
}

export function fontFaceRule(face: CustomFontFace): string {
  return `@font-face{font-family:'${face.family}';src:url('${face.url}') format('${face.format}');font-display:swap;}`;
}
