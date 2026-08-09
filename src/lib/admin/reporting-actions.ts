'use server';

import { revalidatePath } from 'next/cache';
import { assertPermission } from './auth';
import { reconcileRecentPayments } from '@/lib/commerce/reconciliation';

/**
 * [1.5] הרצת התאמה מול מורנינג באופן יזום — עד כה רק ה-cron
 * (api/cron/commerce) הפעיל את reconcileRecentPayments. דוח ההתאמה הוא
 * אחד משלושת הדוחות הקריטיים ביותר מיום הפתיחה; לתת לצוות דרך לבדוק
 * "עכשיו" ולא לחכות לטיק הבא של ה-cron.
 */
export async function runReconciliationNow(): Promise<
  { ok: true; checked: number; mismatched: number } | { ok: false; error: string }
> {
  const session = await assertPermission('finance');
  if ('error' in session) return { ok: false, error: session.error };

  const summary = await reconcileRecentPayments(3);
  if (summary.skipped === 'not_configured') {
    return { ok: false, error: 'מורנינג אינה מוגדרת (מפתחות API חסרים)' };
  }
  revalidatePath('/admin/reports/reconciliation');
  return { ok: true, checked: summary.checked, mismatched: summary.mismatched };
}
