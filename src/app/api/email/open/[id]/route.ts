import { isTrackingId, TRANSPARENT_GIF } from '@/lib/email/tracking';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * פיקסל המעקב של הדואר היוצא — ‎/api/email/open/<email_log.id>.gif‎.
 *
 * ציבורי בהגדרה (לקוח דואר טוען אותו בלי session), ולכן:
 *   • תמיד מחזיר את אותו GIF בסטטוס 200, גם למזהה שגוי או כשהמסד נפל —
 *     אין מה לגלות מתשובה אחרת, ותמונה שבורה במייל גרועה מכל רישום חסר.
 *   • המזהה הוא UUID אקראי; הרישום עצמו (‎record_email_open‎) רק מעלה
 *     מונה על שורה קיימת, ומתעלם מטעינות בתוך 10 שניות מהקודמת.
 *   • no-store: מונע ממטמון להבליע טעינות עתידיות.
 * ראו lib/email/tracking.ts למה המספרים הם רף תחתון ולא ספירה מדויקת.
 */

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: raw } = await params;
  const id = raw.replace(/\.gif$/i, '');

  if (isTrackingId(id)) {
    try {
      const service = createServiceClient();
      if (service) {
        const { error } = await service.rpc('record_email_open', { p_id: id });
        if (error) console.error('[email:open]', error.code, error.message);
      }
    } catch (error) {
      console.error('[email:open]', error);
    }
  }

  return new Response(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(TRANSPARENT_GIF.length),
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}
