import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * הגבלת קצב עמידה על טבלת rate_limits (31_carts_checkout.sql) — משותפת
 * לכל ה-instances, בניגוד למגבל שבזיכרון של טופס הקשר. משמשת את נקודות
 * המסחר: checkout, טוקן אורח, Webhook, קופון.
 *
 * ברירת מחדל fail-open: כשאין מסד או כשהשאילתה נכשלת — מותר. עדיף
 * Checkout בלי הגבלת קצב מאשר חנות מושבתת; הכשל נרשם ללוג.
 *
 * failClosed=true הופך את ההתנהגות עבור דליים רגישי-אבטחה (איפוס סיסמה,
 * התחברות, איתור הזמנה): שם עדיף לחסום זמנית מאשר לאפשר brute-force
 * בלתי-מוגבל בדיוק כשמנגנון ההגנה מושבת. כשל נדיר בקצה זה מקבל הודעת
 * "נסו שוב מאוחר יותר", לא דלת פתוחה.
 */
export async function allowRequest(
  bucket: string,
  max: number,
  windowSeconds: number,
  options?: { failClosed?: boolean },
): Promise<boolean> {
  const onFailure = !options?.failClosed;
  const service = createServiceClient();
  if (!service) return onFailure;

  const { data, error } = await service.rpc('commerce_rate_limit', {
    p_bucket: bucket,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('[commerce:rate-limit]', bucket, error.message);
    return onFailure;
  }
  return data === true;
}

/** מפתח דלי לפי IP מהכותרות — לספירה בלבד, לעולם לא להרשאה. */
export function ipBucket(scope: string, headers: Headers): string {
  const ip =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown';
  return `${scope}:${ip}`;
}
