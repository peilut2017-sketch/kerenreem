'use client';

import { useId, useState, useTransition } from 'react';
import { updateMyEmail, updateMyPassword, setPasswordAfterReset } from '@/lib/admin/account-actions';

type Result = { kind: 'success' | 'error'; message: string } | null;

/**
 * [1.8] שני טפסים עצמאיים (מייל, סיסמה) — לא טופס אחד משותף, כי לכל אחד
 * תוצאת שרת ומצב טעינה משלו; שגיאה בעדכון המייל לא אמורה לנעול את טופס
 * הסיסמה. isPasswordReset (הגעה מקישור שחזור, ?reset=1) מסתיר את שדה
 * "הסיסמה הנוכחית" — ה-session הזמני מהמייל הוא ההוכחה, ואי אפשר לדעת
 * סיסמה ששכחו.
 */
export function AccountSettingsForm({
  email,
  isPasswordReset,
}: {
  email: string | null;
  isPasswordReset: boolean;
}) {
  const id = useId();
  // שני transitions: שגיאה בעדכון המייל לא נועלת את טופס הסיסמה, כמתועד למעלה
  const [emailPending, startEmailTransition] = useTransition();
  const [passwordPending, startPasswordTransition] = useTransition();

  const [newEmail, setNewEmail] = useState(email ?? '');
  const [emailResult, setEmailResult] = useState<Result>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordResult, setPasswordResult] = useState<Result>(null);

  function submitEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailResult(null);
    startEmailTransition(async () => {
      const response = await updateMyEmail(newEmail);
      setEmailResult(
        response.ok
          ? {
              kind: 'success',
              message: 'נשלח קישור אישור לכתובת החדשה. עד לאישור, ההתחברות ממשיכה לפעול עם הכתובת הנוכחית.',
            }
          : { kind: 'error', message: response.error ?? 'שגיאה' },
      );
    });
  }

  function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordResult(null);
    if (newPassword !== confirmPassword) {
      setPasswordResult({ kind: 'error', message: 'הסיסמאות אינן תואמות.' });
      return;
    }
    startPasswordTransition(async () => {
      const response = isPasswordReset
        ? await setPasswordAfterReset(newPassword)
        : await updateMyPassword({ currentPassword, newPassword });
      if (!response.ok) {
        setPasswordResult({ kind: 'error', message: response.error ?? 'שגיאה' });
        return;
      }
      setPasswordResult({ kind: 'success', message: 'הסיסמה עודכנה.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    });
  }

  return (
    <div className="max-w-lg space-y-6">
      {isPasswordReset ? (
        <div role="status" className="admin-card px-5 py-4 border-[var(--admin-accent)]/40">
          <p className="text-small text-ink">אימתנו את זהותכם דרך קישור המייל — בחרו סיסמה חדשה למטה.</p>
        </div>
      ) : null}

      <form onSubmit={submitEmail} className="admin-card px-5 py-4 space-y-4">
        <h2 className="text-small font-bold text-ink">כתובת מייל</h2>
        <div>
          <label htmlFor={`${id}-email`} className="admin-field-label">
            כתובת מייל להתחברות
          </label>
          <input
            id={`${id}-email`}
            type="email"
            dir="ltr"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            className="admin-field-input"
          />
        </div>
        {emailResult ? (
          <p
            role={emailResult.kind === 'error' ? 'alert' : 'status'}
            className={emailResult.kind === 'error' ? 'admin-field-error' : 'text-small text-[var(--admin-accent)]'}
          >
            {emailResult.message}
          </p>
        ) : null}
        <button type="submit" disabled={emailPending} className="admin-btn admin-btn-solid">
          {emailPending ? 'שומר…' : 'עדכון מייל'}
        </button>
      </form>

      <form onSubmit={submitPassword} className="admin-card px-5 py-4 space-y-4">
        <h2 className="text-small font-bold text-ink">{isPasswordReset ? 'קביעת סיסמה חדשה' : 'שינוי סיסמה'}</h2>
        {!isPasswordReset ? (
          <div>
            <label htmlFor={`${id}-current`} className="admin-field-label">
              סיסמה נוכחית
            </label>
            <input
              id={`${id}-current`}
              type="password"
              dir="ltr"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="admin-field-input"
            />
          </div>
        ) : null}
        <div>
          <label htmlFor={`${id}-new`} className="admin-field-label">
            סיסמה חדשה
          </label>
          <input
            id={`${id}-new`}
            type="password"
            dir="ltr"
            autoComplete="new-password"
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className="admin-field-input"
          />
        </div>
        <div>
          <label htmlFor={`${id}-confirm`} className="admin-field-label">
            אימות סיסמה חדשה
          </label>
          <input
            id={`${id}-confirm`}
            type="password"
            dir="ltr"
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="admin-field-input"
          />
        </div>
        {passwordResult ? (
          <p
            role={passwordResult.kind === 'error' ? 'alert' : 'status'}
            className={passwordResult.kind === 'error' ? 'admin-field-error' : 'text-small text-[var(--admin-accent)]'}
          >
            {passwordResult.message}
          </p>
        ) : null}
        <button type="submit" disabled={passwordPending} className="admin-btn admin-btn-solid">
          {passwordPending ? 'שומר…' : isPasswordReset ? 'קביעת סיסמה' : 'עדכון סיסמה'}
        </button>
      </form>
    </div>
  );
}
