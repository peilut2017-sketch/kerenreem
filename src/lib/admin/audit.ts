import 'server-only';

import type { createClient } from '@/lib/supabase/server';

/**
 * [1.11] כתיבה מרוכזת ליומן הביקורת — עם פירוט מלא.
 *
 * עד כה writeAudit רשם רק {מי, מה, טבלה, רשומה}; העמודות old_values/
 * new_values/context (migration 35) נותרו ריקות. המודול הזה הוא נקודת
 * הכתיבה היחידה: כל פעולה בפאנל הניהול עוברת דרכו עם הערכים שלפני
 * ואחרי (לעדכון), הרשומה שנמחקה (למחיקה), ותיאור קריא בעברית (context)
 * — כולל כניסות למערכת והעלאות קבצים.
 *
 * best-effort במכוון: אם הטבלה חסומה או חסרה, זו אינה סיבה להכשיל
 * פעולה שכבר הצליחה. הכשל נרשם לקונסול כדי שלא ייעלם בשקט.
 */

type Supa = NonNullable<Awaited<ReturnType<typeof createClient>>>;

export interface AuditDetails {
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  /** תיאור קריא בעברית — שם הרשומה, מהות הפעולה, פרטים משלימים. */
  context?: string | null;
}

/** קיצוץ ערכים ארוכים (תיאורי HTML שלמים וכד') — היומן מתעד, לא מגבה. */
const MAX_VALUE_LENGTH = 300;

export function compactAuditValues(
  values: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!values) return null;
  const compact: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    compact[key] =
      typeof value === 'string' && value.length > MAX_VALUE_LENGTH
        ? `${value.slice(0, MAX_VALUE_LENGTH)}…`
        : value;
  }
  return compact;
}

/**
 * הפרש לעדכון: רק השדות שערכם השתנה בפועל, לפני ואחרי זה מול זה.
 * שדה שנשלח בטופס עם אותו ערך שהיה — לא מעניין את היומן.
 */
export function diffForAudit(
  oldRecord: Record<string, unknown> | null,
  payload: Record<string, unknown>,
): { oldValues: Record<string, unknown>; newValues: Record<string, unknown> } {
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    const before = oldRecord ? (oldRecord[key] ?? null) : null;
    if (oldRecord && JSON.stringify(before) === JSON.stringify(value ?? null)) continue;
    newValues[key] = value;
    if (oldRecord) oldValues[key] = before;
  }
  return { oldValues, newValues };
}

/** שם תצוגה לרשומה — לשדה ההקשר ביומן. */
export function auditDisplayName(
  ...sources: (Record<string, unknown> | null | undefined)[]
): string | null {
  for (const source of sources) {
    if (!source) continue;
    for (const key of ['title_he', 'name_he', 'label_he', 'full_name', 'title', 'name', 'subject']) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return null;
}

export async function writeAuditLog(
  supabase: Supa,
  userId: string | null,
  action: string,
  table: string,
  recordId: string | null,
  details?: AuditDetails,
): Promise<void> {
  const { error } = await supabase.from('audit_log').insert({
    user_id: userId,
    action,
    table_name: table,
    record_id: recordId,
    old_values: compactAuditValues(details?.oldValues),
    new_values: compactAuditValues(details?.newValues),
    context: details?.context ?? null,
  });

  if (error) console.error('[admin:audit]', error.code, error.message);
}
