import { handleCollect } from '@/lib/analytics/collect';

/**
 * נקודת האיסוף של האנליטיקה העצמאית. נבחרה על פני Server Action כי
 * sendBeacon (הדרך היחידה לשלוח בעזיבת עמוד) מדבר עם כתובת HTTP רגילה, ו-
 * Server Actions מסתדרים בתור אחד-אחד עם ניווט — צפיות נאבדו כשהמבקר עבר
 * עמוד לפני שהקריאה יצאה, מה שהוריד את הספירה מתחת ל-Google Analytics.
 *
 * תמיד 204, גם בכשל או בבקשה פסולה: אין מה לספר למי ששולח, ואין טעם
 * שתיעוד שנכשל ייראה כשגיאה בדפדפן של המבקר.
 */
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 4096;
const NO_CONTENT = () => new Response(null, { status: 204 });

export async function POST(request: Request): Promise<Response> {
  // same-origin בלבד: בקשת דפדפן מאתר אחר נושאת Origin שונה
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return NO_CONTENT();
    } catch {
      return NO_CONTENT();
    }
  }

  const raw = await request.text().catch(() => '');
  if (!raw || raw.length > MAX_BODY_BYTES) return NO_CONTENT();

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NO_CONTENT();
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return NO_CONTENT();

  await handleCollect(payload as Record<string, unknown>, request.headers);
  return NO_CONTENT();
}
