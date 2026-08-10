import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * [1.8] נקודת החזרה של קישור שחזור הסיסמה לצוות הניהול — מקבילה ל-
 * /api/auth/callback הציבורי, אבל מפנה לאזור /admin ולא ל-/account.
 * יושבת תחת /api מאותה סיבה: מחוץ ל-matcher של ניתוב השפות, וההפניה
 * תמיד לנתיב פנימי קבוע (מניעת open redirect).
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}/admin/account?reset=1`);
      console.error('[admin:auth-callback]', error.message);
    }
  }
  return NextResponse.redirect(`${origin}/admin/login?issue=link`);
}
