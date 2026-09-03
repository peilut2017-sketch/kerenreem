import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasPermission, type AdminPermission } from './permissions';
import { ADMIN_ONLY_SCREENS, SCREENS, defaultScreenAccess, type ScreenAccess, type ScreenKey } from './screens';
import type { Profile, UserRole } from '@/lib/supabase/types';
import { hasRole } from './roles';

export interface AdminSession {
  userId: string;
  email: string | null;
  profile: Profile;
  /**
   * הוזמן עם סיסמה ראשונית שנשלחה במייל וטרם החליף אותה
   * (user_metadata.must_change_password, ראו inviteStaffMember).
   * הפריסה מציגה לו קריאה בולטת להחלפה; הדגל נמחק ב-account-actions.
   */
  mustChangePassword: boolean;
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

/**
 * דירוג ליניארי — משרת את שערי *התוכן* הקיימים (requireRole): מוכרן,
 * מלקט ו-store_manager מדורגים מתחת ל-editor ולכן חסומים מעמודי תוכן. שערי
 * *החנות* אינם משתמשים בדירוג — הם דו-ממדיים ועוברים דרך requirePermission
 * (ובהדרגה — requireScreenPermission, screens.ts).
 */
export { hasRole };

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

  const metadata = claims.claims.user_metadata as Record<string, unknown> | undefined;

  return {
    status: 'ok',
    session: {
      userId,
      email,
      profile: profile as Profile,
      mustChangePassword: metadata?.must_change_password === true,
    },
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

/**
 * שער הרשאה דו-ממדי (מודל 1.1): עמודי החנות עוברים כאן ולא דרך הדירוג
 * הליניארי — עורך תוכן חסום מהחנות גם כשהוא "מעל" מוכרן בדירוג.
 */
export async function requirePermission(permission: AdminPermission): Promise<AdminSession> {
  const session = await requireRole('viewer');
  if (!hasPermission(session.profile.role, permission)) redirect('/admin?denied=1');
  return session;
}

/** מקבילת assertRole לפעולות שרת — שגיאה במקום redirect. */
export async function assertPermission(
  permission: AdminPermission,
): Promise<AdminSession | { error: string }> {
  const result = await assertRole('viewer');
  if ('error' in result) return result;
  if (!hasPermission(result.profile.role, permission)) {
    return { error: 'אין הרשאה לפעולה זו' };
  }
  return result;
}

/**
 * [1.7] הרשאה גרגרית פר-מסך (screens.ts) — מחליפה בהדרגה את requireRole/
 * requirePermission, מסך-מסך (ראו שלבי ג'/ד' בתכנית). ה-override, אם קיים,
 * גובר על ברירת המחדל של ה-role; בלי override — ברירת המחדל בלבד.
 *
 * cache()-ה כמו getAdminSessionResult: כל page.tsx/action קורא לזה, ובלי
 * דה-דופליקציה כל טעינת מסך הייתה מבצעת שאילתת overrides נוספת מיותרת.
 */
const getScreenOverrides = cache(async (userId: string): Promise<Map<ScreenKey, ScreenAccess>> => {
  const supabase = await createClient();
  if (!supabase) return new Map();
  const { data } = await supabase
    .from('user_screen_permissions')
    .select('screen_key, can_view, can_edit')
    .eq('user_id', userId);
  const map = new Map<ScreenKey, ScreenAccess>();
  for (const row of data ?? []) {
    map.set(row.screen_key as ScreenKey, { view: row.can_view, edit: row.can_edit });
  }
  return map;
});

/**
 * חשיפה ציבורית של בדיקת ההרשאה, בלי redirect — לעמודי צפייה שצריכים
 * להחליט האם להציג טופס לעריכה או תצוגה בלבד (כמו hasRole(role,'editor')
 * הישן), לא רק לחסום גישה מלאה.
 */
export async function screenAccess(session: AdminSession, screen: ScreenKey): Promise<ScreenAccess> {
  if (ADMIN_ONLY_SCREENS.has(screen)) {
    const allowed = session.profile.role === 'admin';
    return { view: allowed, edit: allowed };
  }
  const overrides = await getScreenOverrides(session.userId);
  return overrides.get(screen) ?? defaultScreenAccess(session.profile.role, screen);
}

/**
 * מפת הרשאות מלאה לכל המסכים, למשתמש הנוכחי — ל-AdminNav (צד לקוח): כדי
 * שהניווט יציג בדיוק את מה שהעמוד עצמו יאפשר (כולל override), לא רק את
 * ברירת המחדל של ה-role, בלי שאילתה נפרדת לכל אחד מ-28 המסכים.
 */
export async function getAllScreenAccess(session: AdminSession): Promise<Record<ScreenKey, ScreenAccess>> {
  const overrides = await getScreenOverrides(session.userId);
  const map = {} as Record<ScreenKey, ScreenAccess>;
  for (const screen of SCREENS) {
    if (ADMIN_ONLY_SCREENS.has(screen.key)) {
      const allowed = session.profile.role === 'admin';
      map[screen.key] = { view: allowed, edit: allowed };
    } else {
      map[screen.key] = overrides.get(screen.key) ?? defaultScreenAccess(session.profile.role, screen.key);
    }
  }
  return map;
}

/** גרסת redirect — חוסמת גישה מלאה למסך (לא רק הסתרת עריכה) כשאין view. */
export async function requireScreenPermission(
  screen: ScreenKey,
  mode: 'view' | 'edit' = 'view',
): Promise<AdminSession> {
  const session = await requireRole('viewer');
  const access = await screenAccess(session, screen);
  if (!access[mode]) redirect('/admin?denied=1');
  return session;
}

/** מקבילת requireScreenPermission לפעולות שרת — שגיאה במקום redirect. */
export async function assertScreenPermission(
  screen: ScreenKey,
  mode: 'view' | 'edit' = 'edit',
): Promise<AdminSession | { error: string }> {
  const result = await assertRole('viewer');
  if ('error' in result) return result;
  const access = await screenAccess(result, screen);
  if (!access[mode]) return { error: 'אין הרשאה לפעולה זו' };
  return result;
}
