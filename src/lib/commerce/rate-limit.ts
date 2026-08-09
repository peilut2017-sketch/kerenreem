import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * הגבלת קצב עמידה על טבלת rate_limits (31_carts_checkout.sql) — משותפת
 * לכל ה-instances, בניגוד למגבל שבזיכרון של טופס הקשר. משמשת את נקודות
 * המסחר: checkout, טוקן אורח, Webhook, קופון.
 *
 * fail-open במכוון כשאין מסד: עדיף Checkout בלי הגבלת קצב מאשר חנות
 * מושבתת; הכשל נרשם ללוג.
 */
export async function allowRequest(
  bucket: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const service = createServiceClient();
  if (!service) return true;

  const { data, error } = await service.rpc('commerce_rate_limit', {
    p_bucket: bucket,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('[commerce:rate-limit]', bucket, error.message);
    return true;
  }
  return data === true;
}

/**
 * מפתח דלי לפי IP מהכותרות — לספירה בלבד, לעולם לא להרשאה.
 *
 * [1.7] הידוק מקור ה-IP: קודם x-real-ip, שספקי האירוח (Vercel וכד') דורסים
 * בערך האמיתי של ה-peer ולכן אינו ניתן לזיוף מהלקוח. אם אין — נלקח ה-hop
 * ה*אחרון* ב-x-forwarded-for (זה שהפרוקסי המהימן הוסיף, הקרוב לשרת), ולא
 * ה-hop הראשון (טענת הלקוח, ניתנת לזיוף בכל בקשה). קודם השתמשנו ב-hop
 * הראשון, כך שכל דלי לפי IP היה עקיף על-ידי כותרת מזויפת — למשל הצפת
 * מיילים דרך sendLoginLink. הדליים שאינם לפי IP (order-find:<מספר>,
 * login-email:<מייל>) נשארים ההגנה שאינה ניתנת לזיוף כנגד enumeration.
 */
export function ipBucket(scope: string, headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  const lastHop = forwarded
    ? forwarded.split(',').map((part) => part.trim()).filter(Boolean).pop()
    : undefined;
  const ip = headers.get('x-real-ip')?.trim() || lastHop || 'unknown';
  return `${scope}:${ip}`;
}
