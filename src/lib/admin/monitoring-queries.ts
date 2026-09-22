import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { canonicalUrlStatus } from '@/lib/site-url';

/**
 * [1.40] הנתונים של לוח הניטור בניהול.
 *
 * שתי שאלות שונות, ולכן שני מקורות:
 *
 *  1. **מה המצב עכשיו** — נבדק כאן ועכשיו, מול המסד והאחסון. אותן
 *     בדיקות בדיוק כמו /api/health/deep, כדי ששני המקומות לא יוכלו
 *     לחלוק על עצמם. המסך הזה הוא הדרך לראות את התשובה בלי להתחבר
 *     לשרת ובלי לשלוף אסימון.
 *  2. **מה קרה** — אירועים מהטבלה, דרך פונקציות security definer
 *     גדורות ב-is_admin() (56_monitoring.sql). הסכימה monitoring
 *     סגורה לחלוטין ל-anon ול-authenticated, וזה החלון היחיד אליה.
 *
 * למה לא לקרוא ל-/api/health/deep מהשרת: זו הייתה קריאת רשת של האתר
 * אל עצמו — אטית, תלויה באסימון, ומסתירה תקלות רשת מאחורי תקלות
 * אפליקציה. הבדיקות זולות ורצות ישירות.
 */

export type CheckStatus = 'ok' | 'warn' | 'fail' | 'skipped';

export interface LiveCheck {
  name: string;
  label: string;
  status: CheckStatus;
  durationMs: number;
  detail?: string | null;
  value?: string | number | null;
}

export interface MonitoringIncident {
  id: string;
  dedupeKey: string;
  scope: string;
  component: string;
  severity: 'warning' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved';
  title: string;
  impact: string | null;
  context: Record<string, unknown>;
  startedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  eventCount: number;
}

export interface IncidentsResult {
  incidents: MonitoringIncident[];
  /**
   * הודעה כשהטבלה אינה קיימת עדיין (המיגרציה לא הורצה) או שהגישה
   * נדחתה. מוצג כהנחיה, לא כתקלה — לוח ריק בלי הסבר נראה כמו שהכול
   * תקין, וזה בדיוק הכישלון שהמערכת הזו אמורה למנוע.
   */
  error: string | null;
  /** true כשהסיבה היא שהמיגרציה טרם הורצה — הנחיה ולא שגיאה. */
  notInstalled: boolean;
}

async function timed(
  name: string,
  label: string,
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<Omit<LiveCheck, 'name' | 'label' | 'durationMs'>>,
): Promise<LiveCheck> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await run(controller.signal);
    return { name, label, durationMs: Date.now() - started, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      name,
      label,
      durationMs: Date.now() - started,
      status: 'fail',
      detail: controller.signal.aborted ? `חריגה מזמן (${timeoutMs}ms)` : message,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** מריץ את בדיקות הבריאות ומחזיר תוצאה לכל שכבה בנפרד. */
export async function runLiveChecks(): Promise<LiveCheck[]> {
  const supabase = await createClient();
  const minBooks = Number(process.env.HEALTH_MIN_PUBLISHED_BOOKS ?? 1);
  const canaryPath = process.env.HEALTH_STORAGE_CANARY ?? '';

  return Promise.all([
    timed('database', 'מסד נתונים', 6000, async () => {
      if (!supabase) return { status: 'skipped' as const, detail: 'Supabase אינו מוגדר' };
      const { error } = await supabase.from('site_settings').select('id').limit(1);
      if (error) return { status: 'fail' as const, detail: `${error.code ?? '—'}: ${error.message}` };
      return { status: 'ok' as const, detail: 'שאילתת קריאה עברה' };
    }),

    timed('catalogue', 'קטלוג', 8000, async () => {
      if (!supabase) return { status: 'skipped' as const, detail: 'Supabase אינו מוגדר' };
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
          detail: `רק ${found} ספרים מפורסמים (מינימום צפוי: ${minBooks})`,
        };
      }
      return { status: 'ok' as const, value: found, detail: `${found} ספרים מפורסמים` };
    }),

    timed('storage', 'אחסון קבצים', 8000, async (signal) => {
      if (!canaryPath) {
        return { status: 'skipped' as const, detail: 'HEALTH_STORAGE_CANARY לא הוגדר' };
      }
      if (!supabase) return { status: 'skipped' as const, detail: 'Supabase אינו מוגדר' };
      const [bucket, ...rest] = canaryPath.split('/');
      const { data } = supabase.storage.from(bucket).getPublicUrl(rest.join('/'));
      const response = await fetch(data.publicUrl, { cache: 'no-store', signal });
      if (!response.ok) {
        return { status: 'fail' as const, detail: `HTTP ${response.status} על ${canaryPath}` };
      }
      const body = await response.arrayBuffer();
      if (body.byteLength < 100) {
        return { status: 'fail' as const, value: body.byteLength, detail: 'הקובץ ריק או חלקי' };
      }
      return {
        status: 'ok' as const,
        value: `${Math.round(body.byteLength / 1024)}KB`,
        detail: 'קובץ העוגן ירד במלואו',
      };
    }),

    timed('canonical', 'כתובת האתר', 100, async () => {
      const status = canonicalUrlStatus();
      if (status.reason === 'ok') return { status: 'ok' as const, value: status.effective };
      return {
        status: 'warn' as const,
        value: status.effective,
        detail:
          status.reason === 'deployment-host'
            ? `NEXT_PUBLIC_SITE_URL מוגדר לכתובת פריסה (${status.configured})`
            : `NEXT_PUBLIC_SITE_URL ${status.reason === 'missing' ? 'לא הוגדר' : 'אינו תקין'}`,
      };
    }),

    timed('email', 'שירות דואר', 100, async () => {
      if (!process.env.RESEND_API_KEY) {
        return { status: 'warn' as const, detail: 'RESEND_API_KEY לא הוגדר — דואר לא נשלח' };
      }
      return { status: 'ok' as const, detail: 'ספק הדואר מוגדר' };
    }),

    timed('alerting', 'קליטת התראות', 100, async () => {
      if (!process.env.INCIDENT_WEBHOOK_SECRET) {
        return {
          status: 'warn' as const,
          detail: 'INCIDENT_WEBHOOK_SECRET לא הוגדר — התראות לא ייכנסו ללוח',
        };
      }
      return { status: 'ok' as const, detail: 'ה-webhook מוכן לקליטה' };
    }),
  ]);
}

/** קודי שגיאה שמשמעותם "המיגרציה טרם הורצה" ולא "משהו נשבר". */
const MISSING_SCHEMA_CODES = new Set(['42P01', '42883', 'PGRST202']);

export async function listIncidents(limit = 50): Promise<IncidentsResult> {
  const supabase = await createClient();
  if (!supabase) {
    return { incidents: [], error: 'אין חיבור למסד', notInstalled: false };
  }

  const { data, error } = await supabase.rpc('admin_list_incidents', {
    p_limit: limit,
    p_include_resolved: true,
  });

  if (error) {
    const notInstalled =
      MISSING_SCHEMA_CODES.has(error.code ?? '') ||
      /does not exist/i.test(error.message);
    console.error('[admin:monitoring] incidents', error.code, error.message);
    return {
      incidents: [],
      notInstalled,
      error: notInstalled
        ? 'טבלת האירועים טרם נוצרה — יש להריץ את supabase/56_monitoring.sql על מסד הנתונים.'
        : `${error.code ?? '—'}: ${error.message}`,
    };
  }

  type Row = {
    id: string;
    dedupe_key: string;
    scope: string;
    component: string;
    severity: string;
    status: string;
    title: string;
    impact: string | null;
    context: Record<string, unknown> | null;
    started_at: string;
    acknowledged_at: string | null;
    resolved_at: string | null;
    resolution: string | null;
    event_count: number | string;
  };

  const incidents = ((data as Row[] | null) ?? []).map((row) => ({
    id: row.id,
    dedupeKey: row.dedupe_key,
    scope: row.scope,
    component: row.component,
    severity: row.severity === 'critical' ? ('critical' as const) : ('warning' as const),
    status: row.status as MonitoringIncident['status'],
    title: row.title,
    impact: row.impact,
    context: row.context ?? {},
    startedAt: row.started_at,
    acknowledgedAt: row.acknowledged_at,
    resolvedAt: row.resolved_at,
    resolution: row.resolution,
    // ‏count() ב-Postgres הוא bigint, ו-PostgREST מחזיר אותו כמחרוזת.
    eventCount: Number(row.event_count ?? 0),
  }));

  return { incidents, error: null, notInstalled: false };
}
