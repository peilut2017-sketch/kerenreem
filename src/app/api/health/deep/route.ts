import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createStaticClient } from '@/lib/supabase/server';
import { canonicalUrlStatus } from '@/lib/site-url';

/**
 * [1.40] בדיקת בריאות עמוקה — בודקת כל שכבה בנפרד ואומרת *מי* נפל.
 *
 * הלקח מהאירוע שבו הקטלוג הוצג ריק: "האתר מחזיר 200" אינו אומר דבר.
 * PostgreSQL היה חסר, PostgREST החזיר שגיאות, והאתר בכל זאת הגיש
 * עמודים — חלקם ממטמון ISR ישן, חלקם עם רשימה ריקה. מוניטור שבודק רק
 * קוד תשובה של עמוד הבית היה ממשיך להראות ירוק.
 *
 * לכן כל שכבה נבדקת לחוד, וכל בדיקה מחזירה סטטוס וזמן תגובה משלה:
 *   database  — שאילתת קריאה אמיתית דרך PostgREST (anon), לא ping.
 *   catalogue — *מספר* הספרים המפורסמים הנגישים ל-anon. אפס ספרים הוא
 *               תקלה, גם כשהתשובה עצמה תקינה — זה בדיוק המצב שבו
 *               הקטלוג הוצג ריק בלי שאף בדיקה צעקה.
 *   storage   — הורדה אמיתית של קובץ עוגן, כולל בדיקת סוג וגודל.
 *   canonical — האם הכתובת הציבורית שהאתר משדר היא הדומיין הנכון.
 *
 * סף הספרים ניתן להגדרה (HEALTH_MIN_PUBLISHED_BOOKS) ולא קבוע בקוד:
 * הוא תלוי בקטלוג בפועל, והוא אמור לעלות עם הזמן.
 *
 * קוד התשובה נושא משמעות: 200 כשהכול תקין, 503 כשיש כשל אמיתי. כך
 * מוניטור פשוט (Uptime Kuma, blackbox) מזהה תקלה בלי לפרסר JSON, ומי
 * שכן מפרסר מקבל את הפירוט המלא.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 20;

/** השוואה קבועת-זמן — אותו דפוס כמו /api/cron/commerce. */
function secretMatches(provided: string, secret: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

type CheckStatus = 'ok' | 'warn' | 'fail' | 'skipped';

interface Check {
  name: string;
  status: CheckStatus;
  durationMs: number;
  detail?: string;
  value?: number | string | null;
}

/** מריץ בדיקה עם תקרת זמן משלה, כדי ששכבה תקועה לא תתקע את כולן. */
async function timed(
  name: string,
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<Omit<Check, 'name' | 'durationMs'>>,
): Promise<Check> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await run(controller.signal);
    return { name, durationMs: Date.now() - started, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      name,
      durationMs: Date.now() - started,
      status: 'fail',
      detail: controller.signal.aborted ? `timeout after ${timeoutMs}ms` : message,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  /*
   * מוגנת בסוד. הבדיקה מריצה שאילתות אמיתיות ומורידה קובץ בכל קריאה,
   * ונתיב פתוח כזה הוא גם ערוץ עומס נוח וגם חושף את מבנה התשתית. סוד
   * נפרד מ-CRON_SECRET בכוונה: המוניטור יושב על מכונה אחרת, ואין סיבה
   * שסוד שמאפשר להריץ משימות מסחר יסתובב גם שם.
   */
  const secret = process.env.HEALTH_CHECK_SECRET ?? process.env.CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ')
    ? header.slice('Bearer '.length)
    : (new URL(request.url).searchParams.get('token') ?? '');
  if (!secret || !secretMatches(provided, secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const minBooks = Number(process.env.HEALTH_MIN_PUBLISHED_BOOKS ?? 1);
  const canaryPath = process.env.HEALTH_STORAGE_CANARY ?? '';

  const supabase = createStaticClient();

  const checks = await Promise.all([
    // ---- מסד נתונים: קריאה אמיתית, לא ping -------------------------------
    timed('database', 6000, async () => {
      if (!supabase) return { status: 'skipped' as const, detail: 'Supabase not configured' };
      const { error } = await supabase.from('site_settings').select('id').limit(1);
      if (error) return { status: 'fail' as const, detail: `${error.code ?? '—'}: ${error.message}` };
      return { status: 'ok' as const };
    }),

    // ---- קטלוג: כמה ספרים *באמת* נגישים לגולש אנונימי --------------------
    timed('catalogue', 8000, async () => {
      if (!supabase) return { status: 'skipped' as const, detail: 'Supabase not configured' };
      const { count, error } = await supabase
        .from('books')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true);
      if (error) return { status: 'fail' as const, detail: `${error.code ?? '—'}: ${error.message}` };

      const found = count ?? 0;
      if (found < minBooks) {
        return {
          status: 'fail' as const,
          value: found,
          detail: `רק ${found} ספרים מפורסמים נגישים ל-anon (מינימום צפוי: ${minBooks})`,
        };
      }
      return { status: 'ok' as const, value: found };
    }),

    // ---- אחסון: הורדה אמיתית של קובץ עוגן --------------------------------
    timed('storage', 8000, async (signal) => {
      if (!canaryPath) {
        return {
          status: 'skipped' as const,
          detail: 'HEALTH_STORAGE_CANARY לא הוגדר — ראו docs/monitoring',
        };
      }
      if (!supabase) return { status: 'skipped' as const, detail: 'Supabase not configured' };

      const { data } = supabase.storage
        .from(canaryPath.split('/')[0])
        .getPublicUrl(canaryPath.split('/').slice(1).join('/'));

      // GET ולא HEAD: Storage יכול להחזיר 200 על HEAD בעוד שהגוף עצמו
      // ריק או שגוי. אותנו מעניין שהקובץ באמת יורד.
      const response = await fetch(data.publicUrl, { cache: 'no-store', signal });
      if (!response.ok) {
        return { status: 'fail' as const, detail: `HTTP ${response.status} על ${canaryPath}` };
      }
      const body = await response.arrayBuffer();
      const type = response.headers.get('content-type') ?? '';
      if (body.byteLength < 100) {
        return { status: 'fail' as const, value: body.byteLength, detail: 'הקובץ ריק או חלקי' };
      }
      if (!type.startsWith('image/')) {
        return { status: 'warn' as const, detail: `סוג תוכן לא צפוי: ${type || 'לא ידוע'}` };
      }
      return { status: 'ok' as const, value: body.byteLength };
    }),

    // ---- כתובת קנונית: האם האתר משדר את הדומיין הנכון --------------------
    timed('canonical-url', 100, async () => {
      const status = canonicalUrlStatus();
      if (status.reason === 'deployment-host') {
        return {
          status: 'warn' as const,
          value: status.effective,
          detail: `NEXT_PUBLIC_SITE_URL מוגדר לכתובת פריסה (${status.configured}); נעשה שימוש ב-${status.effective}`,
        };
      }
      if (status.reason === 'missing' || status.reason === 'invalid') {
        return {
          status: 'warn' as const,
          value: status.effective,
          detail: `NEXT_PUBLIC_SITE_URL ${status.reason === 'missing' ? 'לא הוגדר' : 'אינו תקין'}; נעשה שימוש ב-${status.effective}`,
        };
      }
      return { status: 'ok' as const, value: status.effective };
    }),
  ]);

  const failed = checks.filter((check) => check.status === 'fail');
  const warned = checks.filter((check) => check.status === 'warn');
  const overall: CheckStatus = failed.length > 0 ? 'fail' : warned.length > 0 ? 'warn' : 'ok';

  return NextResponse.json(
    {
      status: overall,
      time: new Date().toISOString(),
      build: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
      checks,
      // סיכום קצר בשורה אחת — זה מה שנכנס לגוף ההתראה.
      summary:
        overall === 'ok'
          ? 'כל הבדיקות עברו'
          : [...failed, ...warned].map((check) => `${check.name}: ${check.detail ?? check.status}`).join(' · '),
    },
    {
      // ‏warn עדיין 200: אזהרה אינה השבתה, ומוניטור שמסמן אותה אדומה
      // מאמן את הצוות להתעלם ממנו. 503 שמור לכשל אמיתי.
      status: overall === 'fail' ? 503 : 200,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    },
  );
}
