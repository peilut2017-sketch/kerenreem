import { getSiteSettings } from '@/lib/data';

/**
 * מגיש את הלוגו שהועלה ב-CMS כאייקון האתר (לשונית הדפדפן), עם נפילה
 * לסימן הקבוע כשלא הועלה לוגו.
 *
 * Route Handler רגיל, ולא הקובץ המיוחד app/icon.tsx: הלוגו הוא כתובת
 * חיצונית (Supabase Storage) שאינה ידועה בזמן הבנייה, ושפורמט הקובץ שלה
 * משתנה לפי מה שהמנהל העלה (SVG/PNG/WebP) — Route Handler רגיל תומך
 * בכך במפורש (Response עם content-type דינמי), בלי להסתמך על חוזה פחות
 * מתועד של קובץ המוסכמה המיוחד. שני ה-root layout (הציבורי והניהול)
 * מצביעים לכתובת הזו דרך שדה `icons` ב-metadata — ראו שם.
 */
export const revalidate = 3600;

/** אותו סימן שהיה ב-icon.svg הסטטי — שלושה ספרים על מדף — לשעה שאין לוגו. */
const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="מכון קרן רא&quot;ם">
  <rect width="32" height="32" fill="#faf7f0"/>
  <rect x="6" y="7" width="5" height="17" fill="#6b1f26"/>
  <rect x="13" y="10" width="5" height="14" fill="#23304a"/>
  <rect x="20" y="8" width="5" height="16" fill="#96762a"/>
  <rect x="5" y="24" width="22" height="1.5" fill="#17150f"/>
</svg>`;

function fallback(): Response {
  return new Response(FALLBACK_SVG, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

export async function GET() {
  const settings = await getSiteSettings();
  if (!settings.logo_url) return fallback();

  try {
    const upstream = await fetch(settings.logo_url, { next: { revalidate: 3600 } });
    if (!upstream.ok) return fallback();

    const bytes = await upstream.arrayBuffer();
    return new Response(bytes, {
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    // רשת חסומה, כתובת שהתיישנה וכו' — נופלים לסימן הקבוע ולא לאייקון שבור.
    console.error('[site-icon] נכשל בשליפת הלוגו, נופל לסימן ברירת המחדל', error);
    return fallback();
  }
}
