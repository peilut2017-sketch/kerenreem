'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { recordAdminLogin } from '@/lib/admin/activity-audit-actions';

/**
 * התחברות בדואר אלקטרוני וסיסמה מול Supabase Auth.
 *
 * ההתחברות מתבצעת בדפדפן כדי ש-supabase-js יכתוב את עוגיות ה-session;
 * ה-proxy קורא אותן בבקשה הבאה ומאמת את הטוקן מול השרת.
 *
 * השדות אינם controlled בכוונה, והערכים נקראים מה-FormData בזמן השליחה.
 * מנהלי סיסמאות והשלמה אוטומטית של הדפדפן מציבים ערך ישירות על ה-DOM
 * בלי לפלוט אירוע ש-React מזהה. בשדה controlled ה-state נשאר ריק בעוד
 * שהשדה נראה מלא, הוולידציה של הדפדפן עוברת (כי ב-DOM יש ערך), ו-Supabase
 * מקבל מחרוזת ריקה ומחזיר validation_failed: missing email or phone.
 * קריאה מה-FormData מחזירה תמיד את מה שבשדה בפועל.
 */
export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    if (!email || !password) {
      setError('יש למלא דואר אלקטרוני וסיסמה.');
      return;
    }

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
      // ההודעה למשתמש נשארת כללית כדי לא לחשוף אילו כתובות רשומות במערכת,
      // אבל השגיאה המקורית נרשמת לקונסול — בלעדיה אי אפשר לאבחן תקלות
      // הגדרה (מפתח שגוי, ספק Email מכובה) והן נראות כמו סיסמה שגויה.
      console.error('[admin:login]', signInError.message);
      setError('פרטי ההתחברות שגויים.');
      setPending(false);
      return;
    }

    // [1.11] תיעוד הכניסה ביומן הביקורת — הזהות נקראת מה-session בשרת.
    // fire-and-forget במפורש ולא await: קריאת שרת שנתקעת (רשת אטית,
    // חיבור למסד עמוס) הייתה משאירה את הכפתור על "מתחבר…" לנצח, גם
    // אחרי שההתחברות עצמה כבר הצליחה — לא רק כשל, גם תקיעה, לא נחסמים.
    void recordAdminLogin();

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
          name="email"
          type="email"
          dir="ltr"
          required
          autoComplete="username"
          className="field-input"
        />
      </div>

      <div>
        <label htmlFor={`${id}-password`} className="field-label">
          סיסמה
        </label>
        <input
          id={`${id}-password`}
          name="password"
          type="password"
          dir="ltr"
          required
          autoComplete="current-password"
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
