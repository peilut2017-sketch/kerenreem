import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * [1.6] יומן ביקורת (ביקורת ג.37/ט.5) — הטבלה קיימת עם 17 נקודות כתיבה
 * פעילות, ואף מסך לא קרא ממנה. מסך קריאה-בלבד, בלי migration: העמודות
 * old_values/new_values/actor_type/context כבר קיימות (migration 35).
 *
 * הערה כנה: writeAudit המשותף (actions.ts) עדיין כותב רק {user_id,
 * action, table_name, record_id} — old_values/new_values נשארים null
 * לרוב שינויי הקטלוג, כפי שהביקורת תיעדה. תיקון זה דורש שינוי בכל אחת
 * מ-17 נקודות הכתיבה (שליפת המצב שלפני עדכון בכל אחת) — לא "מסך קריאה
 * בלבד", ולכן לא כלול כאן; המסך מציג את מה שכן קיים (מי, מתי, מה,
 * ועבור הנקודות שכבר מעבירות ערכים — גם שינוי בפועל).
 */

export const AUDIT_PAGE_SIZE = 50;

export interface AuditLogRow {
  id: string;
  userId: string | null;
  userName: string | null;
  action: string;
  tableName: string;
  recordId: string | null;
  actorType: string;
  context: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogFilter {
  tableName?: string;
  page?: string;
}

export interface AuditLogResult {
  rows: AuditLogRow[];
  total: number | null;
  page: number;
  pageSize: number;
  error: boolean;
}

export const AUDIT_TABLE_LABELS: Record<string, string> = {
  books: 'ספרים',
  authors: 'מחברים',
  events: 'אירועים',
  activities: 'פעילויות',
  pages: 'עמודים',
  banners: 'באנרים',
  categories: 'קטגוריות',
  series: 'סדרות',
  tags: 'תגיות',
  contact_topics: 'נושאי פנייה',
  contact_fields: 'שדות פנייה',
  shipping_methods: 'שיטות משלוח',
  store_settings: 'הגדרות חנות',
  site_settings: 'הגדרות אתר',
  coupons: 'קופונים',
  profiles: 'צוות',
  orders: 'הזמנות',
  book_costs: 'עלויות ספרים',
};

export async function listAuditLog(filter: AuditLogFilter): Promise<AuditLogResult> {
  const page = Math.max(1, Math.floor(Number(filter.page) || 1));
  const pageSize = AUDIT_PAGE_SIZE;
  const empty = (error: boolean): AuditLogResult => ({ rows: [], total: error ? null : 0, page, pageSize, error });

  const supabase = await createClient();
  if (!supabase) return empty(true);

  let query = supabase
    .from('audit_log')
    .select('id, user_id, action, table_name, record_id, actor_type, context, old_values, new_values, created_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (filter.tableName) query = query.eq('table_name', filter.tableName);

  const { data, error, count } = await query;
  if (error) {
    console.error('[admin:audit-log] list', error.message);
    return empty(true);
  }

  const rows = data ?? [];
  const userIds = [...new Set(rows.map((r) => r.user_id).filter((id): id is string => Boolean(id)))];
  const nameById = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
    for (const profile of profiles ?? []) nameById.set(profile.id, profile.full_name ?? '—');
  }

  return {
    rows: rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_id ? (nameById.get(row.user_id) ?? 'משתמש שהוסר') : null,
      action: row.action,
      tableName: row.table_name,
      recordId: row.record_id,
      actorType: row.actor_type,
      context: row.context,
      oldValues: row.old_values as Record<string, unknown> | null,
      newValues: row.new_values as Record<string, unknown> | null,
      createdAt: row.created_at,
    })),
    total: count ?? null,
    page,
    pageSize,
    error: false,
  };
}
