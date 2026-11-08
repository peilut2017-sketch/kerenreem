import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { assertRole, assertScreenPermission } from './auth';

/**
 * ‏[1.44] קריאת יומן הדואר היוצא (email_log) למסכי הניהול.
 *
 * הטבלה סגורה ל-anon/authenticated (supabase/60_*.sql) ונקראת דרך
 * service_role, ולכן כל פונקציה כאן פותחת בשער הרשאה — ראו הכללים ב-
 * lib/supabase/service.ts.
 */

export interface EmailTracking {
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  opens: number;
  first_opened_at: string | null;
  last_opened_at: string | null;
}

export interface EmailLogRow extends EmailTracking {
  id: string;
  created_at: string;
  to_address: string;
  subject: string;
  label: string | null;
  error: string | null;
}

/** ההודעות האחרונות שנשלחו, לחדשה ביותר. מנהל בלבד — המסך מציג כתובות נמענים. */
export async function listEmailLog(limit = 100): Promise<EmailLogRow[]> {
  const session = await assertRole('admin');
  if ('error' in session) return [];
  const service = createServiceClient();
  if (!service) return [];

  const { data, error } = await service
    .from('email_log')
    .select('id, created_at, to_address, subject, label, status, error, opens, first_opened_at, last_opened_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[admin:email-log]', error.code, error.message);
    return [];
  }
  return (data as EmailLogRow[] | null) ?? [];
}

/** מצב הצפייה של הודעות לפי מזהה יומן — לשרשור הפנייה. */
export async function getEmailTracking(ids: string[]): Promise<Map<string, EmailTracking>> {
  const result = new Map<string, EmailTracking>();
  if (ids.length === 0) return result;

  const session = await assertScreenPermission('messages', 'view');
  if ('error' in session) return result;
  const service = createServiceClient();
  if (!service) return result;

  const { data, error } = await service
    .from('email_log')
    .select('id, status, opens, first_opened_at, last_opened_at')
    .in('id', ids);
  if (error) {
    console.error('[admin:email-log]', error.code, error.message);
    return result;
  }
  for (const row of (data as (EmailTracking & { id: string })[] | null) ?? []) {
    result.set(row.id, row);
  }
  return result;
}
