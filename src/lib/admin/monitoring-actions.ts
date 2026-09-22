'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from './auth';
import { writeAuditLog } from './audit';

/**
 * [1.40] הפעולות של לוח הניטור.
 *
 * שתי פעולות בלבד, ושתיהן על אירוע קיים: סימון "בטיפול" וסגירה ידנית.
 * אין כאן שום פעולת תיקון אוטומטית — לא הפעלה מחדש של שירות, לא ניקוי
 * מטמון, לא נגיעה בקונטיינרים. זו הייתה החלטה מפורשת: מערכת שמנסה
 * לתקן בעצמה היא מערכת שיכולה גם להזיק בעצמה, ובדיוק זה מה שאסור כאן.
 * המערכת מתריעה ומתעדת; אדם מחליט ופועל לפי ה-runbook.
 */

export interface MonitoringActionResult {
  ok: boolean;
  error?: string;
}

export interface IncidentTimelineEntry {
  id: number;
  at: string;
  kind: string;
  message: string;
  data: Record<string, unknown>;
}

/** ציר הזמן של אירוע — נטען לפי דרישה, בפתיחת השורה. */
export async function getIncidentTimeline(
  incidentId: string,
): Promise<{ entries: IncidentTimelineEntry[]; error?: string }> {
  const session = await assertRole('admin');
  if ('error' in session) return { entries: [], error: session.error };

  const supabase = await createClient();
  if (!supabase) return { entries: [], error: 'אין חיבור למסד' };

  const { data, error } = await supabase.rpc('admin_incident_timeline', {
    p_incident_id: incidentId,
  });
  if (error) {
    console.error('[admin:monitoring] timeline', error.code, error.message);
    return { entries: [], error: `${error.code ?? '—'}: ${error.message}` };
  }

  type Row = { id: number; at: string; kind: string; message: string; data: Record<string, unknown> | null };
  return {
    entries: ((data as Row[] | null) ?? []).map((row) => ({
      id: row.id,
      at: row.at,
      kind: row.kind,
      message: row.message,
      data: row.data ?? {},
    })),
  };
}

export async function setIncidentStatus(
  incidentId: string,
  status: 'acknowledged' | 'resolved',
  note?: string,
): Promise<MonitoringActionResult> {
  const session = await assertRole('admin');
  if ('error' in session) return { ok: false, error: session.error };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'אין חיבור למסד' };

  const { data, error } = await supabase.rpc('admin_set_incident_status', {
    p_incident_id: incidentId,
    p_status: status,
    p_note: note?.trim() || null,
  });
  if (error) {
    console.error('[admin:monitoring] setStatus', error.code, error.message);
    return { ok: false, error: `${error.code ?? '—'}: ${error.message}` };
  }
  if (data !== true) return { ok: false, error: 'האירוע לא נמצא' };

  await writeAuditLog(supabase, session.userId, 'update', 'monitoring_incidents', incidentId, {
    newValues: { status },
    context: `${status === 'acknowledged' ? 'סימון אירוע כבטיפול' : 'סגירת אירוע ידנית'}${
      note ? ` — ${note}` : ''
    }`,
  });

  revalidatePath('/admin/monitoring');
  return { ok: true };
}
