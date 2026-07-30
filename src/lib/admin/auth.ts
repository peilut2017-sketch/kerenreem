import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, UserRole } from '@/lib/supabase/types';

export interface AdminSession {
  userId: string;
  email: string | null;
  profile: Profile;
}

/**
 * תוצאת בדיקת ההרשאה.
 *
 * ההפרדה בין 'no-session' ל-'no-profile' חיונית: המשתמש מאומת מול Auth
 * אבל אין לו שורה ב-profiles. אם מפנים אותו במקרה כזה למסך ההתחברות,
 * הוא מתחבר בהצלחה, חוזר ל-/admin, שוב אין פרופיל — ונוצרת לולאה אינסופית
 * שנראית כאילו ההתחברות נכשלה. לכן זהו מצב נפרד עם הסבר משלו.
 */
export type AdminSessionResult =
  | { status: 'ok'; session: AdminSession }
  | { status: 'no-session' }
  | { status: 'no-profile'; userId: string; email: string | null }
  /**
   * שליפת הפרופיל נכשלה — להבדיל מ"אין פרופיל".
   * הגורם השכיח: הרשאות התפקידים anon/authenticated על סכימת public נמחקו
   * (למשל אחרי drop schema public cascade), ולכן המסד מחזיר permission
   * denied. הנתונים קיימים, אבל האתר אינו רשאי לקרוא אותם. בלי הבחנה
   * מפורשת התקלה נראית בדיוק כמו משתמש שלא הוגדר, והתיקון המוצע שגוי.
   */
  | { status: 'profile-error'; userId: string; email: string | null; message: string }
  | { status: 'not-configured' };

const RANK: Record<UserRole, number> = { viewer: 0, editor: 1, admin: 2 };

export function hasRole(role: UserRole, minimum: UserRole): boolean {
  return RANK[role] >= RANK[minimum];
}

/**
 * מחזיר את מצב ההרשאה של הבקשה הנוכחית.
 *
 * ה-proxy כבר חוסם גישה ל-/admin ללא session, אבל בדיקה חוזרת כאן היא
 * מכוונת: proxy אפשר לעקוף בקריאה ישירה ל-Server Action, ולכן ההרשאה
 * נבדקת גם בנקודת השימוש.
 */
/**
 * עטוף ב-cache() של React: הפונקציה נקראת גם ב-layout וגם בכל page, ובלי
 * דה-דופליקציה כל טעינת מסך ניהול הייתה מבצעת שתי קריאות רשת ל-Supabase
 * Auth ושתי שאילתות profiles — לפני שנשלף ולו נתון תוכן אחד. cache מצמצם
 * את כולן לקריאה אחת לכל בקשה.
 */
export const getAdminSessionResult = cache(async (): Promise<AdminSessionResult> => {
  const supabase = await createClient();
  if (!supabase) return { status: 'not-configured' };

  // getClaims() מאמת את חתימת ה-JWT. כשמוגדרים מפתחות חתימה א-סימטריים
  // האימות נעשה מקומית מול JWKS שנשמר במטמון — בלי סבב רשת כלל. בהגדרה
  // הישנה (סוד סימטרי) הוא נופל בחזרה ל-getUser(), כלומר אותה רמת אבטחה
  // בדיוק כמו קודם ובלי האטה נוספת. פג תוקף נבדק בשני המקרים.
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (claimsError || !userId) return { status: 'no-session' };

  const email = typeof claims.claims.email === 'string' ? claims.claims.email : null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[admin:auth] קריאת הפרופיל נכשלה', error.code, error.message);
    return {
      status: 'profile-error',
      userId,
      email,
      message: error.message,
    };
  }

  if (!profile) return { status: 'no-profile', userId, email };

  return {
    status: 'ok',
    session: { userId, email, profile: profile as Profile },
  };
});

/** גרסה מקוצרת לשימוש היכן שרק ההצלחה מעניינת. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const result = await getAdminSessionResult();
  return result.status === 'ok' ? result.session : null;
}

/** מחייב session עם תפקיד מינימלי. מפנה למסך המתאים כשאין. */
export async function requireRole(minimum: UserRole = 'viewer'): Promise<AdminSession> {
  const result = await getAdminSessionResult();

  switch (result.status) {
    case 'ok':
      if (!hasRole(result.session.profile.role, minimum)) redirect('/admin?denied=1');
      return result.session;

    case 'no-profile':
      // לא מפנים למסך ההתחברות — הוא לא יפתור דבר ורק ייצור לולאה.
      redirect('/admin/login?issue=no_profile');
      break;

    case 'profile-error':
      redirect('/admin/login?issue=profile_error');
      break;

    case 'not-configured':
      redirect('/admin/login?issue=not_configured');
      break;

    default:
      redirect('/admin/login');
  }

  // לא נגיע לכאן — redirect זורק.
  throw new Error('unreachable');
}

/** גרסה לשימוש בתוך Server Actions: מחזירה שגיאה במקום redirect. */
export async function assertRole(minimum: UserRole): Promise<AdminSession | { error: string }> {
  const result = await getAdminSessionResult();

  if (result.status === 'no-profile') {
    return { error: 'למשתמש אין פרופיל במערכת. יש להגדיר לו תפקיד.' };
  }
  if (result.status === 'profile-error') {
    return { error: `קריאת ההרשאות נכשלה: ${result.message}` };
  }
  if (result.status !== 'ok') return { error: 'לא מחובר' };
  if (!hasRole(result.session.profile.role, minimum)) return { error: 'אין הרשאה לפעולה זו' };

  return result.session;
}
