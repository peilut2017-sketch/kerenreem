import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, UserRole } from '@/lib/supabase/types';

export interface AdminSession {
  userId: string;
  email: string | null;
  profile: Profile;
}

const RANK: Record<UserRole, number> = { viewer: 0, editor: 1, admin: 2 };

export function hasRole(role: UserRole, minimum: UserRole): boolean {
  return RANK[role] >= RANK[minimum];
}

/**
 * מחזיר את המשתמש המחובר ואת הפרופיל שלו, או null.
 *
 * ה-proxy כבר חוסם גישה ל-/admin ללא session, אבל בדיקה חוזרת כאן היא
 * מכוונת: proxy אפשר לעקוף בקריאה ישירה ל-Server Action, ולכן ההרשאה
 * נבדקת גם בנקודת השימוש.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) return null;

  return { userId: user.id, email: user.email ?? null, profile: profile as Profile };
}

/** מחייב session עם תפקיד מינימלי; מפנה להתחברות או לדשבורד אם אין די הרשאה. */
export async function requireRole(minimum: UserRole = 'viewer'): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  if (!hasRole(session.profile.role, minimum)) redirect('/admin?denied=1');
  return session;
}

/** גרסה לשימוש בתוך Server Actions: מחזירה שגיאה במקום redirect. */
export async function assertRole(minimum: UserRole): Promise<AdminSession | { error: string }> {
  const session = await getAdminSession();
  if (!session) return { error: 'לא מחובר' };
  if (!hasRole(session.profile.role, minimum)) return { error: 'אין הרשאה לפעולה זו' };
  return session;
}
