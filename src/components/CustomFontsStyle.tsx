import { getCustomFonts } from '@/lib/data';
import { customFontFace, fontFaceRule, type CustomFontFace } from '@/lib/custom-font-face';

/**
 * [1.11] הזרקת הגופנים המותקנים (custom_fonts) — ‏@font-face לכל גופן
 * פעיל, ומשתנה CSS ‏--font-custom-<slug> שדרכו העורך והתוכן השמור
 * פונים אליו (ראו sanitize.ts).
 *
 * כללי הבטיחות ויישור הכתובת (כתובת מלפני מעבר ספק אחסון) יושבים
 * ב-custom-font-face.ts — משותפים לתצוגה המקדימה בניהול (FontsManager).
 */
export async function CustomFontsStyle() {
  const faces = (await getCustomFonts())
    .map((font) => customFontFace(font))
    .filter((face): face is CustomFontFace => face !== null);
  if (faces.length === 0) return null;

  const rules = faces.map(fontFaceRule).join('\n');
  const vars = faces
    .map((face) => `--font-custom-${face.slug}:'${face.family}',var(--font-assistant);`)
    .join('');

  return <style>{`${rules}\n:root{${vars}}`}</style>;
}
