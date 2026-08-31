import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * [1.8] נקודת החזרה של קישור שחזור הסיסמה לצוות הניהול — מקבילה ל-
 * /api/auth/callback הציבורי, אבל מפנה לאזור /admin ולא ל-/account.
 * יושבת תחת /api מאותה סיבה: מחוץ ל-matcher של ניתוב השפות, וההפניה
 * תמיד לנתיב פנימי קבוע (מניעת open redirect).
 */
export const dynamic = 'force-dynamic';

/**
 * עוגיית הסימון של זרימת השחזור: setPasswordAfterReset דורש אותה, כך
 * שרק session שנוצר *כאן* — מלחיצה על קישור השחזור מהמייל — רשאי לקבוע
 * סיסמה בלי לדעת את הנוכחית. בלי הסימון, כל session חי (גם חטוף או
 * עמדה שנשארה פתוחה) היה יכול להחליף סיסמה ולנעול את הבעלים בחוץ.
 * השם משוכפל ב-account-actions.ts — route.ts אינו רשאי לייצא ערכים
 * שאינם חלק מחוזה ה-Route Handlers של Next.
 */
const PW_RESET_COOKIE = 'kr-pw-reset';

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const response = NextResponse.redirect(`${origin}/admin/account?reset=1`);
        response.cookies.set(PW_RESET_COOKIE, '1', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 10 * 60,
          path: '/',
        });
        return response;
      }
      console.error('[admin:auth-callback]', error.message);
    }
  }
  return NextResponse.redirect(`${origin}/admin/login?issue=link`);
}
