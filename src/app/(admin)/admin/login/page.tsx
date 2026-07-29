import { LoginForm } from '@/components/admin/LoginForm';
import { SignOutButton } from '@/components/admin/SignOutButton';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getAdminSessionResult } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; issue?: string }>;
}) {
  const [{ next, issue }, result] = await Promise.all([searchParams, getAdminSessionResult()]);

  // המשתמש מאומת אבל אין לו שורה ב-profiles. הצגת טופס התחברות כאן היא
  // מלכודת: הוא יתחבר שוב, ייזרק שוב, ויחשוב שהסיסמה שגויה.
  const noProfile = issue === 'no_profile' || result.status === 'no-profile';

  // שליפת הפרופיל נכשלה — כמעט תמיד הרשאות חסרות, לא פרופיל חסר.
  const profileError = issue === 'profile_error' || result.status === 'profile-error';
  const errorMessage = result.status === 'profile-error' ? result.message : null;
  const permissionDenied = /permission denied/i.test(errorMessage ?? '');

  return (
    <div className="mx-auto flex min-h-dvh max-w-[32rem] flex-col justify-center px-6 py-16">
      <h1 className="font-serif text-h2 text-ink">ניהול תוכן</h1>
      <p className="mt-2 text-small text-muted">מכון קרן רא״ם</p>

      {!isSupabaseConfigured ? (
        <p className="mt-10 border-s-2 border-burgundy bg-paper-2 px-4 py-3 text-small text-ink-soft">
          חסרים משתני הסביבה של Supabase. ראו <code>.env.example</code> ו-README.
        </p>
      ) : profileError ? (
        <div className="mt-10 border-s-2 border-burgundy bg-paper-2 px-5 py-4">
          <h2 className="font-semibold text-ink">
            {permissionDenied ? 'לאתר אין הרשאת גישה לטבלאות' : 'קריאת ההרשאות נכשלה'}
          </h2>

          {permissionDenied ? (
            <>
              <p className="mt-2 text-small leading-relaxed text-ink-soft">
                ההתחברות הצליחה והנתונים קיימים במסד — אבל התפקידים{' '}
                <code>anon</code> ו-<code>authenticated</code>, שדרכם האתר ניגש למסד,
                איבדו את הרשאות הגישה לסכימת <code>public</code>.
              </p>
              <p className="mt-3 text-small leading-relaxed text-ink-soft">
                זה קורה אחרי <code dir="ltr">drop schema public cascade</code>: Supabase
                מעניקה את ההרשאות האלה מראש, והן נמחקות יחד עם הסכימה. יצירתה מחדש
                אינה מחזירה אותן. ב-SQL Editor הכל נראה תקין, כי הוא רץ בתפקיד{' '}
                <code>postgres</code>.
              </p>
              <p className="mt-4 text-small font-semibold text-ink">
                התיקון — להריץ ב-SQL Editor:
              </p>
              <pre
                dir="ltr"
                className="mt-2 overflow-x-auto border border-rule bg-paper p-3 text-caption leading-relaxed"
              >{`grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;`}</pre>
              <p className="mt-3 text-small text-muted">
                מדיניות ה-RLS אינה מושפעת — היא ממשיכה לקבוע אילו שורות נראות.
                הקובץ <code>supabase/06_restore_grants.sql</code> מכיל גם שאילתת אבחון.
              </p>
            </>
          ) : (
            <p className="mt-2 text-small leading-relaxed text-ink-soft">
              המסד החזיר שגיאה בעת קריאת הפרופיל. זו אינה בעיית סיסמה.
            </p>
          )}

          {errorMessage ? (
            <p className="mt-4 text-caption text-muted">
              הודעת המסד: <span dir="ltr">{errorMessage}</span>
            </p>
          ) : null}

          <div className="mt-5 border-t border-rule pt-4 text-small">
            <SignOutButton />
          </div>
        </div>
      ) : noProfile ? (
        <div className="mt-10 border-s-2 border-burgundy bg-paper-2 px-5 py-4">
          <h2 className="font-semibold text-ink">ההתחברות הצליחה, אבל אין למשתמש פרופיל</h2>
          <p className="mt-2 text-small leading-relaxed text-ink-soft">
            החשבון קיים ומאומת מול Supabase Auth, אך אין לו שורה מתאימה בטבלת{' '}
            <code>profiles</code> — ולכן אין לו תפקיד ואין לו הרשאה לשום מסך.
          </p>
          <p className="mt-3 text-small leading-relaxed text-ink-soft">
            זה קורה כשהמשתמש נוצר לפני הרצת הסכימה, או כשהסכימה הורצה מחדש אחרי
            שהמשתמש כבר היה קיים: <code>auth.users</code> שורד, אבל{' '}
            <code>profiles</code> נוצרת מחדש ריקה.
          </p>

          {result.status === 'no-profile' && result.email ? (
            <p className="mt-3 text-small text-ink-soft">
              המשתמש המחובר: <span dir="ltr">{result.email}</span>
            </p>
          ) : null}

          <p className="mt-4 text-small font-semibold text-ink">
            התיקון — להריץ ב-SQL Editor של Supabase:
          </p>
          <pre
            dir="ltr"
            className="mt-2 overflow-x-auto border border-rule bg-paper p-3 text-caption leading-relaxed"
          >{`insert into profiles (id, full_name, role)
select id,
       coalesce(raw_user_meta_data->>'full_name', email),
       'admin'
from auth.users
where email = '${result.status === 'no-profile' && result.email ? result.email : 'your@email.com'}'
on conflict (id) do update set role = 'admin';`}</pre>

          <p className="mt-4 text-small text-muted">
            אחרי ההרצה — רעננו את העמוד. הקובץ <code>supabase/05_repair_profiles.sql</code>{' '}
            מכיל גם גרסה שמתקנת את כל המשתמשים בבת אחת.
          </p>

          <div className="mt-5 border-t border-rule pt-4 text-small">
            <SignOutButton />
            <span className="ms-2 text-muted">— אם ברצונכם להתחבר בחשבון אחר</span>
          </div>
        </div>
      ) : (
        <div className="mt-10">
          <LoginForm next={next} />
        </div>
      )}
    </div>
  );
}
