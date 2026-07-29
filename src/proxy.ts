import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './lib/supabase/config';

const intlMiddleware = createIntlMiddleware(routing);

/** מסלולי ניהול שמותר להגיע אליהם בלי session. */
const ADMIN_PUBLIC_PATHS = ['/admin/login', '/admin/auth/callback'];

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

  // getUser() מאמת את הטוקן מול השרת. אין להסתמך על getSession() ב-middleware:
  // הוא קורא את העוגייה בלבד ולכן ניתן לזיוף.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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
    // כל מה שאינו נכס סטטי, קובץ API פנימי או קובץ עם סיומת
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
