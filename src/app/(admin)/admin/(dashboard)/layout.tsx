import { requireRole, getAllScreenAccess } from '@/lib/admin/auth';
import { countNewInquiries } from '@/lib/admin/queries';
import { getCustomFonts } from '@/lib/data';
import { AdminNav } from '@/components/admin/AdminNav';
import { AdminShell } from '@/components/admin/AdminShell';
import { CustomFontsProvider } from '@/components/admin/custom-fonts-context';
import { AdminIcon } from '@/components/admin/AdminIcons';
import { ROLE_LABELS } from '@/lib/admin/permissions';
import { SignOutButton } from '@/components/admin/SignOutButton';
import { ToastHost } from '@/components/admin/ToastHost';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // בלי הגדרת סביבה אין מסד ואין אימות — מציגים הסבר במקום מסך שבור.
  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-[46rem] px-6 py-20">
        <h1 className="text-h2 text-ink">ממשק הניהול אינו מחובר למסד</h1>
        <p className="mt-4 text-ink-soft">
          חסרים משתני הסביבה <code>NEXT_PUBLIC_SUPABASE_URL</code> ו-
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. ראו את קובץ{' '}
          <code>.env.example</code> וההוראות ב-README.
        </p>
      </div>
    );
  }

  const session = await requireRole('viewer');
  // getCustomFonts אינו תלוי ב-session/screenAccess — נטען במקביל אליהם
  // ולא אחריהם, כדי לא להוסיף עוד סבב רשת רציף לזמן הטעינה אחרי התחברות.
  const [screenAccess, customFonts] = await Promise.all([getAllScreenAccess(session), getCustomFonts()]);
  // תג "פניות חדשות" על "פניות שהתקבלו" — נטען רק למי שרואה את המסך
  const unreadMessages = screenAccess.messages?.view ? await countNewInquiries() : 0;
  // גופנים מותקנים — לבורר הגופנים בעורכי הטקסט, ראו custom-fonts-context
  const customFontChoices = customFonts.map((font) => ({
    label: font.name,
    value: `var(--font-custom-${font.slug})`,
  }));

  return (
    <CustomFontsProvider fonts={customFontChoices}>
      {/* מורכב פעם אחת ברמת הפריסה, לא בתוך עמוד — כך הודעת "נשמר" נשארת
          גלויה גם כש-EntityForm מנווט משם מיד אחרי, ראו toast-bus.ts. */}
      <ToastHost />

      <AdminShell
        brand={
          <>
            <span className="admin-sidebar-brand-mark">
              <AdminIcon name="dashboard" className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 font-serif text-[1.05rem] leading-tight">ניהול תוכן</span>
          </>
        }
        nav={<AdminNav role={session.profile.role} screenAccess={screenAccess} unreadMessages={unreadMessages} />}
        accountLabel={
          <>
            {session.profile.full_name || session.email}
            {' · '}
            {ROLE_LABELS[session.profile.role]}
          </>
        }
        signOutButton={<SignOutButton />}
      >
        {children}
      </AdminShell>
    </CustomFontsProvider>
  );
}
