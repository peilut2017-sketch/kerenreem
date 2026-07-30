import { createClient } from '@/lib/supabase/server';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from '@/lib/supabase/config';

/**
 * אבחון חיבור שאינו דורש התחברות.
 *
 * מסך האבחון המלא יושב מאחורי requireRole, ולכן הוא חסר ערך בדיוק במצב
 * הזה: כשההתחברות עצמה נכשלת אי אפשר להגיע אליו. הבדיקות כאן רצות לפני
 * כל אימות ועונות על השאלה הראשונה שצריך לענות עליה — לאיזה פרויקט
 * הבנייה הזו בכלל פונה.
 *
 * אין כאן חשיפת מידע: כתובת הפרויקט והמפתח האנונימי מוטמעים ממילא בקוד
 * שהדפדפן מוריד, מעצם הגדרתם כ-NEXT_PUBLIC. המפתח מוצג מקוצר כדי שאפשר
 * יהיה להשוות אותו למה שב-Supabase בלי להדביק אותו במלואו למקום כלשהו.
 */
export async function LoginDiagnostics() {
  const host = (() => {
    try {
      return new URL(SUPABASE_URL).hostname;
    } catch {
      return null;
    }
  })();

  const checks: { label: string; ok: boolean; detail: string }[] = [];

  checks.push({
    label: 'משתני הסביבה',
    ok: isSupabaseConfigured,
    detail: isSupabaseConfigured ? 'קיימים' : 'חסרים NEXT_PUBLIC_SUPABASE_URL / ANON_KEY',
  });

  checks.push({
    label: 'הפרויקט שהבנייה פונה אליו',
    ok: Boolean(host),
    detail: host ?? 'כתובת לא תקינה',
  });

  checks.push({
    label: 'המפתח האנונימי',
    ok: SUPABASE_ANON_KEY.length > 0,
    detail: SUPABASE_ANON_KEY
      ? `${SUPABASE_ANON_KEY.slice(0, 8)}…${SUPABASE_ANON_KEY.slice(-4)}`
      : 'חסר',
  });

  if (isSupabaseConfigured) {
    // שרת האימות: אם הוא אינו עונה, אין טעם לבדוק דבר אחר
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
        headers: { apikey: SUPABASE_ANON_KEY },
        cache: 'no-store',
      });
      checks.push({
        label: 'שרת האימות',
        ok: response.ok,
        detail: response.ok ? 'עונה' : `החזיר ${response.status}`,
      });
    } catch (error) {
      checks.push({
        label: 'שרת האימות',
        ok: false,
        detail: error instanceof Error ? error.message : 'לא נענה',
      });
    }

    // הטבלה שבלעדיה אין תפקידים, ולכן אין כניסה לניהול
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.from('profiles').select('id', { head: true, count: 'exact' });
      const hint =
        error?.code === '42P01'
          ? ' — הסכימה לא הותקנה בפרויקט הזה. הריצו את קובצי supabase/ לפי הסדר'
          : error?.code === '42501'
            ? ' — חסרות הרשאות. הריצו supabase/06_restore_grants.sql'
            : '';
      checks.push({
        label: 'טבלת profiles',
        ok: !error,
        detail: error ? `${error.code ?? '—'}: ${error.message}${hint}` : 'נגישה',
      });
    }
  }

  const allOk = checks.every((check) => check.ok);

  return (
    <details className="mt-8 border border-rule bg-cream-2 px-4 py-3 text-small" open={!allOk}>
      <summary className="cursor-pointer font-semibold text-ink">
        בדיקת חיבור {allOk ? '— תקין' : '— נמצאו תקלות'}
      </summary>

      <ul className="mt-3 space-y-1.5">
        {checks.map((check) => (
          <li key={check.label} className="flex flex-wrap items-baseline gap-x-3">
            <span aria-hidden="true" className={check.ok ? 'text-gold-deep' : 'text-burgundy'}>
              {check.ok ? '✓' : '✗'}
            </span>
            <span className="font-semibold">
              {check.label}
              <span className="sr-only">{check.ok ? ' — תקין' : ' — נכשל'}</span>
            </span>
            <span className={check.ok ? 'text-muted' : 'text-burgundy'} dir="auto">
              {check.detail}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-caption leading-relaxed text-muted">
        אחרי החלפת פרויקט: המשתנים <code>NEXT_PUBLIC_*</code> נצרבים לתוך הבנייה,
        ולכן שינוי שלהם אינו משפיע עד <strong>פריסה מחדש</strong>. אם הכתובת שלמעלה
        אינה הפרויקט החדש — זו הסיבה.
      </p>
    </details>
  );
}
