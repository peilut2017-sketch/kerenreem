import { getCustomFonts } from '@/lib/data';
import { isProjectStorageUrl } from '@/lib/image-src';

/**
 * [1.11] הזרקת הגופנים המותקנים (custom_fonts) — ‏@font-face לכל גופן
 * פעיל, ומשתנה CSS ‏--font-custom-<slug> שדרכו העורך והתוכן השמור
 * פונים אליו (ראו sanitize.ts).
 *
 * בטיחות ה-CSS: ה-slug מאומת במסד ([a-z0-9-] בלבד) וכתובת הקובץ חייבת
 * להיות באחסון הפרויקט/CDN — כתובת זרה מדולגת. כך אין דרך להזריק CSS
 * חופשי דרך שורת גופן, וה-CSP (font-src) ממילא סוגר את הדלת השנייה.
 */
const SLUG_PATTERN = /^[a-z0-9-]{1,40}$/;

function fontFormat(url: string): string {
  if (url.endsWith('.woff2')) return 'woff2';
  if (url.endsWith('.woff')) return 'woff';
  if (url.endsWith('.otf')) return 'opentype';
  return 'truetype';
}

export async function CustomFontsStyle() {
  const fonts = (await getCustomFonts()).filter(
    (font) =>
      SLUG_PATTERN.test(font.slug) &&
      isProjectStorageUrl(font.font_url) &&
      !/['"\\)]/.test(font.font_url),
  );
  if (fonts.length === 0) return null;

  const faces = fonts
    .map(
      (font) => `@font-face{font-family:'kr-font-${font.slug}';src:url('${font.font_url}') format('${fontFormat(font.font_url)}');font-display:swap;}`,
    )
    .join('\n');
  const vars = fonts
    .map((font) => `--font-custom-${font.slug}:'kr-font-${font.slug}',var(--font-assistant);`)
    .join('');

  return <style>{`${faces}\n:root{${vars}}`}</style>;
}
