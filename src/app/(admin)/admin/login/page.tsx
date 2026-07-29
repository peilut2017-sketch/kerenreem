import { LoginForm } from '@/components/admin/LoginForm';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[26rem] flex-col justify-center px-6 py-16">
      <h1 className="font-serif text-h2 text-ink">ניהול תוכן</h1>
      <p className="mt-2 text-small text-muted">מכון קרן רא״ם</p>

      {isSupabaseConfigured ? (
        <div className="mt-10">
          <LoginForm next={next} />
        </div>
      ) : (
        <p className="mt-10 border-s-2 border-burgundy bg-paper-2 px-4 py-3 text-small text-ink-soft">
          חסרים משתני הסביבה של Supabase. ראו <code>.env.example</code> ו-README.
        </p>
      )}
    </div>
  );
}
