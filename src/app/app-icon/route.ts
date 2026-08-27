import sharp from 'sharp';
import { getSiteSettings } from '@/lib/data';

/**
 * [1.37] אייקון ריבועי (PNG) של האתר — לקובץ ה-manifest (התקנה כאפליקציה
 * בנייד) ול-apple-touch-icon. בניגוד ל-/site-icon (שמגיש את קובץ הלוגו
 * כפי שהוא, כי לשונית דפדפן מקבלת כל פורמט/יחס-גובה-רוחב), כאן היעד
 * הוא ריבוע PNG במידה מדויקת: iOS לא מרנדר SVG ב-apple-touch-icon, ו-
 * manifest.icons מצפה למידות קבועות. sharp ממיר כל פורמט/יחס שהמנהל
 * העלה לריבוע אחיד עם ריפוד, כמו שדרת ספר על מדף ולא מתיחה/חיתוך.
 */
export const revalidate = 3600;

const BACKGROUND = '#faf7f0';
/** אותו סימן שב-/site-icon — שלושה ספרים על מדף — כשלא הועלה לוגו. */
const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="מכון קרן רא&quot;ם">
  <rect width="32" height="32" fill="${BACKGROUND}"/>
  <rect x="6" y="7" width="5" height="17" fill="#6b1f26"/>
  <rect x="13" y="10" width="5" height="14" fill="#23304a"/>
  <rect x="20" y="8" width="5" height="16" fill="#96762a"/>
  <rect x="5" y="24" width="22" height="1.5" fill="#17150f"/>
</svg>`;

async function render(size: number, sourceBytes: Buffer | null): Promise<Buffer> {
  const canvas = sharp({
    create: { width: size, height: size, channels: 4, background: BACKGROUND },
  });

  const logo = sourceBytes ?? Buffer.from(FALLBACK_SVG);
  // שוליים סביב הלוגו כדי שלא ייגע בקצוות — נראה קטום ב-iOS שמעגל את הפינות בעצמו.
  const inner = Math.round(size * 0.78);
  const resized = await sharp(logo)
    .resize(inner, inner, { fit: 'contain', background: BACKGROUND })
    .toBuffer();

  return canvas
    .composite([{ input: resized, gravity: 'center' }])
    .png()
    .toBuffer();
}

export async function GET(request: Request) {
  const requested = Number(new URL(request.url).searchParams.get('size'));
  const size = Number.isFinite(requested) ? Math.min(1024, Math.max(32, Math.round(requested))) : 512;

  const settings = await getSiteSettings();
  let sourceBytes: Buffer | null = null;
  if (settings.logo_url) {
    try {
      const upstream = await fetch(settings.logo_url, { next: { revalidate: 3600 } });
      if (upstream.ok) sourceBytes = Buffer.from(await upstream.arrayBuffer());
    } catch (error) {
      console.error('[app-icon] נכשל בשליפת הלוגו, נופל לסימן ברירת המחדל', error);
    }
  }

  try {
    const png = await render(size, sourceBytes);
    return new Response(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[app-icon] נכשל ברינדור, נופל לסימן ברירת המחדל', error);
    const png = await render(size, null);
    return new Response(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }
}
