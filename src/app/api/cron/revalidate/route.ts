import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { runBoundaryRevalidation } from '@/lib/revalidation/run';

/**
 * ‏[1.42] רענון חלונות הזמן — המסלול שהחליף את ה-ISR מבוסס-הזמן.
 *
 * שלושה מעברים באתר קורים לפי שעון ובלי ששום שורה במסד משתנה: פתיחה
 * וסגירה של מבצע, פתיחה וסגירה של באנר, ואירוע שעובר מ"קרוב" ל"היה".
 * עד כה הם נתפסו בכך שכל עמוד מושפע נכתב מחדש כל דקה — כ-1,900 כתיבות
 * ISR בשעה שבהן ברוב המוחלט של הזמן לא השתנה דבר.
 *
 * כאן שואלים פעם ב-15 דקות אם נחצה גבול, ורק אם כן מרעננים — נתיבים
 * קונקרטיים, בשתי השפות, כל נתיב פעם אחת. ההיגיון ב-lib/revalidation/.
 *
 * למה מסלול נפרד ולא בתוך /api/cron/commerce: זה רץ כל 15 דקות והוא
 * כל-כולו רענון מטמון; משימות התחזוקה המסחריות רצות פעם ביום ונוגעות
 * בהזמנות, במלאי ובדואר. כשל בזה אינו אמור להשפיע על ההן, ולהפך.
 *
 * ‏force-dynamic: מסלול שמרענן מטמון ואינו נשמר בו בעצמו.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** השוואה קבועת-זמן — כמו בשאר נתיבי הסוד באתר. */
function secretMatches(provided: string, secret: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!secret || !secretMatches(provided, secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await runBoundaryRevalidation();

  /*
   * שורת log מובנית אחת בכל ריצה — כולל ריצה ריקה. זה מה שמאפשר לראות
   * ב-log-drain שהמנגנון באמת רץ ובאמת אינו כותב כלום כשאין שינוי; בלי
   * זה "אפס כתיבות" ו"הקרון מת" נראים אותו דבר בדיוק.
   */
  console.log('[cron:revalidate]', JSON.stringify(result));

  /*
   * לא-2xx בכשל: אחרת המתזמן מתריע רק על שגיאות, וכשל שחוזר בכל ריצה
   * נשאר "ירוק" לנצח בעוד שהסמן תקוע והמבצעים אינם מתחילים.
   */
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
