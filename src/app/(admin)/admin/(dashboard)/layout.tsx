import Link from 'next/link';
import { requireRole, getAllScreenAccess } from '@/lib/admin/auth';
import { countNewInquiries } from '@/lib/admin/queries';
import { getCustomFonts } from '@/lib/data';
import { AdminNav } from '@/components/admin/AdminNav';
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
  // תג "פניות חדשות" על לשונית הפניות — נטען רק למי שרואה את המסך
  const unreadMessages = screenAccess.messages?.view ? await countNewInquiries() : 0;
  // גופנים מותקנים — לבורר הגופנים בעורכי הטקסט, ראו custom-fonts-context
  const customFontChoices = customFonts.map((font) => ({
    label: font.name,
    value: `var(--font-custom-${font.slug})`,
  }));

  return (
    <CustomFontsProvider fonts={customFontChoices}>
    <div className="flex min-h-dvh flex-col bg-[var(--admin-canvas)]">
      {/* מורכב פעם אחת ברמת הפריסה, לא בתוך עמוד — כך הודעת "נשמר" נשארת
          גלויה גם כש-EntityForm מנווט משם מיד אחרי, ראו toast-bus.ts. */}
      <ToastHost />

      {/* הכותרת נדבקת לראש החלון, כמו באתר הציבורי: בטבלה ארוכה הניווט
          היה נעלם למעלה וכל מעבר בין מסכים חייב גלילה חזרה. */}
      <header className="sticky top-0 z-30 border-b border-[var(--admin-border)] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[80rem] flex-wrap items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2.5 font-serif text-[1.25rem] text-ink">
              <span className="admin-icon-chip h-9 w-9">
                <AdminIcon name="dashboard" className="h-4.5 w-4.5" />
              </span>
              ניהול תוכן
            </Link>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="admin-nav-link"
            >
              <AdminIcon name="external" className="h-4 w-4" />
              צפייה באתר
            </a>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/admin/account"
              className="hidden text-caption text-muted hover:text-ink sm:inline"
              title="החשבון שלי — שינוי מייל וסיסמה"
            >
              {session.profile.full_name || session.email}
              {' · '}
              {ROLE_LABELS[session.profile.role]}
            </Link>
            <SignOutButton />
          </div>
        </div>

        <div className="mx-auto w-full max-w-[80rem] px-6 pb-3">
          <AdminNav role={session.profile.role} screenAccess={screenAccess} unreadMessages={unreadMessages} />
        </div>
      </header>

      <div className="mx-auto w-full max-w-[80rem] flex-1 px-6 py-8">
        <main className="min-w-0">{children}</main>
      </div>
    </div>
    </CustomFontsProvider>
  );
}
