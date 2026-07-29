'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * התחברות בדואר אלקטרוני וסיסמה מול Supabase Auth.
 *
 * ההתחברות מתבצעת בדפדפן כדי ש-supabase-js יכתוב את עוגיות ה-session;
 * ה-proxy קורא אותן בבקשה הבאה ומאמת את הטוקן מול השרת.
 */
export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const id = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createClient();
    if (!supabase) {
      setError('החיבור למסד אינו מוגדר.');
      setPending(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      // לא חושפים אם הכתובת קיימת — מונע מיפוי משתמשים.
      setError('פרטי ההתחברות שגויים.');
      setPending(false);
      return;
    }

    // ההפניה מוגבלת לנתיבים פנימיים תחת /admin, כדי שפרמטר next
    // לא ישמש להפניה לאתר חיצוני.
    const target = next && /^\/admin(\/|$)/.test(next) ? next : '/admin';
    router.replace(target);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label htmlFor={`${id}-email`} className="field-label">
          דואר אלקטרוני
        </label>
        <input
          id={`${id}-email`}
          type="email"
          dir="ltr"
          required
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="field-input"
        />
      </div>

      <div>
        <label htmlFor={`${id}-password`} className="field-label">
          סיסמה
        </label>
        <input
          id={`${id}-password`}
          type="password"
          dir="ltr"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="field-input"
        />
      </div>

      {error ? (
        <p role="alert" className="field-error">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn btn-solid w-full">
        {pending ? 'מתחבר…' : 'כניסה'}
      </button>
    </form>
  );
}
