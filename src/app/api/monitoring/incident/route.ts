import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * [1.40] קולט התראות מ-Alertmanager והופך אותן לאירועים בלוח האירועים.
 *
 * למה בכלל: כלי הניטור יודע "מה אדום עכשיו". מה שחסר אחרי כל תקלה
 * הוא הסיפור — מתי התחיל, איזה שירות נפל ראשון, מה הייתה ההשפעה,
 * איזה build רץ, ומה סגר את זה. זה ציר זמן, והוא צריך טבלה.
 *
 * הזרימה: Alertmanager שולח לכאן webhook על כל התראה שנדלקת ועל כל
 * אחת שנפתרת (send_resolved). כאן זה מתורגם לקריאה ל-
 * monitoring.raise_incident / monitoring.resolve_incident — שתיהן
 * אטומיות, ושתיהן מקבצות לפי dedupe_key כך שנפילה אחת עם עשרה
 * תסמינים היא אירוע אחד עם עשר שורות בציר הזמן.
 *
 * הכתיבה דרך service_role: הסכימה monitoring סגורה ל-anon ול-
 * authenticated לחלוטין (ראו 56_monitoring.sql), ואין כאן session
 * של משתמש — זו קריאה ממכונת הניטור. השער היחיד הוא הסוד.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function secretMatches(provided: string, secret: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** מבנה ה-webhook של Alertmanager, החלקים שאנחנו משתמשים בהם. */
interface AlertmanagerAlert {
  status?: 'firing' | 'resolved';
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  startsAt?: string;
  generatorURL?: string;
  fingerprint?: string;
}

interface AlertmanagerPayload {
  status?: 'firing' | 'resolved';
  alerts?: AlertmanagerAlert[];
  commonLabels?: Record<string, string>;
}

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.INCIDENT_WEBHOOK_SECRET;
  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!secret || !secretMatches(provided, secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const service = createServiceClient();
  if (!service) {
    // 503 ולא 500: זו תקלת הגדרה שלנו, ו-Alertmanager ינסה שוב.
    return NextResponse.json({ error: 'service client not configured' }, { status: 503 });
  }

  let payload: AlertmanagerPayload;
  try {
    payload = (await request.json()) as AlertmanagerPayload;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const alerts = payload.alerts ?? [];
  if (alerts.length === 0) return NextResponse.json({ handled: 0 });

  let opened = 0;
  let resolved = 0;
  const errors: string[] = [];

  for (const alert of alerts) {
    const labels = alert.labels ?? {};
    const annotations = alert.annotations ?? {};

    const scope = labels.scope ?? 'unknown';
    const component = labels.component ?? labels.alertname ?? 'unknown';
    // מפתח הקיבוץ: שכבה + רכיב. שתי התראות שונות על אותו רכיב הן
    // אותה תקלה, ואין סיבה שיפתחו שני אירועים.
    const dedupeKey = `${scope}:${component}`;

    if ((alert.status ?? payload.status) === 'resolved') {
      const { error } = await service.schema('monitoring').rpc('resolve_incident', {
        p_dedupe_key: dedupeKey,
        p_resolution: 'auto — הבדיקה חזרה לתקינות',
      });
      if (error) errors.push(`${dedupeKey}: ${error.message}`);
      else resolved += 1;
      continue;
    }

    const { error } = await service.schema('monitoring').rpc('raise_incident', {
      p_dedupe_key: dedupeKey,
      p_scope: scope,
      p_component: component,
      p_severity: labels.severity === 'critical' ? 'critical' : 'warning',
      p_title: annotations.summary ?? labels.alertname ?? 'התראה ללא כותרת',
      p_impact: annotations.impact ?? null,
      p_context: {
        alertname: labels.alertname ?? null,
        instance: labels.instance ?? null,
        runbook: annotations.runbook ?? null,
        generatorURL: alert.generatorURL ?? null,
        startsAt: alert.startsAt ?? null,
        fingerprint: alert.fingerprint ?? null,
      },
      p_symptom: annotations.summary ?? null,
    });
    if (error) errors.push(`${dedupeKey}: ${error.message}`);
    else opened += 1;
  }

  if (errors.length > 0) {
    console.error('[monitoring:incident]', errors.join(' | '));
    // 207 ולא 500: חלק מההתראות נקלטו, ו-Alertmanager לא אמור לנסות
    // לשלוח שוב את כולן ולהכפיל את מה שכבר נרשם.
    return NextResponse.json({ opened, resolved, errors }, { status: 207 });
  }

  return NextResponse.json({ opened, resolved });
}
