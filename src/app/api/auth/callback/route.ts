import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * נקודת החזרה של קישור ההתחברות מהמייל (פרק 4.4): החלפת הקוד ב-session
 * והפניה לאזור האישי. יושבת תחת /api — מחוץ ל-matcher של ה-proxy — כדי
 * שניתוב השפות לא ייגע בה; ההפניה תמיד לנתיב פנימי קבוע, לא לפרמטר
 * מהבקשה (מניעת open redirect).
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
      if (!error) return NextResponse.redirect(`${origin}/account`);
      console.error('[commerce:auth-callback]', error.message);
    }
  }
  return NextResponse.redirect(`${origin}/account/login?issue=link`);
}
