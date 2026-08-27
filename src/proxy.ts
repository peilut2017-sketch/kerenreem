import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './lib/supabase/config';

const intlMiddleware = createIntlMiddleware(routing);

/**
 * מסלולי ניהול שמותר להגיע אליהם בלי session.
 *
 * ה-callback עצמו (/api/auth/admin-callback) אינו כאן — הוא כבר מוחרג
 * לגמרי מה-matcher למטה (כל api/), ולא חי תחת /admin מלכתחילה.
 */
const ADMIN_PUBLIC_PATHS = ['/admin/login'];

async function handleAdmin(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (ADMIN_PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // בלי הגדרת Supabase אין אימות אפשרי; העמוד עצמו יסביר מה חסר.
  if (!isSupabaseConfigured) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getSession() ולא getUser(): כאן לא מתקבלת שום החלטת אבטחה.
  //
  // getUser() פונה לשרת האימות ברשת בכל בקשה — כולל כל ניווט וכל שליחת
  // טופס — וזה היה סבב רשת שלם לפני שהתחילה העבודה האמיתית. getSession()
  // קורא את העוגייה ופונה לרשת רק כשהטוקן באמת דורש רענון, וזה התפקיד
  // היחיד שנחוץ בשכבה הזו: לשמור על ה-session חי ולהפנות מוקדם כשאין כזה.
  //
  // מה שקורא העוגייה מחזיר אינו אמין, ולכן הוא אינו קובע הרשאה: כל עמוד
  // ניהול קורא ל-requireRole שמאמת את החתימה, כל Server Action קורא
  // ל-assertRole, ומעל הכל RLS במסד אוכף לפי המשתמש האמיתי. עוגייה מזויפת
  // תעבור כאן ותיעצר בשלוש השכבות שאחריה.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    // רישום מפורש: בלעדיו הפניה חוזרת למסך ההתחברות נראית זהה בין
    // "אין עוגייה" לבין "העוגייה קיימת אבל הטוקן נדחה", ואי אפשר לאבחן.
    const hasAuthCookie = request.cookies.getAll().some((cookie) => cookie.name.startsWith('sb-'));
    console.warn(
      `[proxy:admin] אין משתמש מאומת עבור ${pathname} — עוגיית session ${
        hasAuthCookie ? 'קיימת אך לא אומתה' : 'חסרה'
      }`,
    );

    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

/**
 * Next 16 קורא לשכבה הזו "proxy" (לשעבר middleware). היא עושה שני דברים:
 * מנתבת שפה לכל האתר הציבורי, ושומרת על /admin מאחורי session מאומת.
 */
export default async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    return handleAdmin(request);
  }
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // [1.37] site-icon/app-icon הוחרגו במפורש: שני Route Handler בלי סיומת
    // בנתיב (favicon דינמי ואייקון ה-PWA, ראו שם) — בלי ההחרגה הזו הביטוי
    // "קובץ עם סיומת" לא תפס אותם, ה-middleware ניתב אותם ל-/he/site-icon
    // וכד' שלא קיים, ולשונית הדפדפן/מסך הבית קיבלו 404 במקום אייקון.
    '/((?!api|_next|_vercel|site-icon|app-icon|.*\\..*).*)',
  ],
};
