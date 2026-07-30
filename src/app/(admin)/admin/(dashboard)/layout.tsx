import Link from 'next/link';
import { requireRole } from '@/lib/admin/auth';
import { AdminNav } from '@/components/admin/AdminNav';
import { SignOutButton } from '@/components/admin/SignOutButton';
import { isSupabaseConfigured } from '@/lib/supabase/config';

const ROLE_LABELS = { admin: 'מנהל', editor: 'עורך', viewer: 'צופה' } as const;

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

  return (
    <div className="flex min-h-dvh flex-col">
      {/* הכותרת נדבקת לראש החלון, כמו באתר הציבורי: בטבלה ארוכה הניווט
          היה נעלם למעלה וכל מעבר בין מסכים חייב גלילה חזרה. */}
      <header className="sticky top-0 z-30 border-b border-rule bg-cream-2/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[80rem] flex-wrap items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-baseline gap-3">
            <Link href="/admin" className="font-serif text-[1.25rem] text-ink">
              ניהול תוכן
            </Link>
            <Link
              href="/"
              className="text-caption text-muted underline underline-offset-4 hover:text-burgundy"
            >
              צפייה באתר
            </Link>
          </div>

          <div className="flex items-center gap-4 text-caption text-muted">
            <span>
              {session.profile.full_name || session.email}
              {' · '}
              {ROLE_LABELS[session.profile.role]}
            </span>
            <SignOutButton />
          </div>
        </div>

        <div className="mx-auto w-full max-w-[80rem] px-6 pb-2">
          <AdminNav role={session.profile.role} />
        </div>
      </header>

      <div className="mx-auto w-full max-w-[80rem] flex-1 px-6 py-8">
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
