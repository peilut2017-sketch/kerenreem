'use client';

import { useId, useState, useTransition } from 'react';
import { requestAdminPasswordReset } from '@/lib/admin/account-actions';

/**
 * [1.8] מקופל מאחורי "שכחתם סיסמה?" בכוונה — לא טופס גלוי תמיד לצד
 * ההתחברות, כדי לא להסיח את הזרימה הרגילה (99% מהכניסות).
 */
export function ForgotPasswordForm() {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-caption text-muted underline underline-offset-2 hover:text-burgundy"
      >
        שכחתם סיסמה?
      </button>
    );
  }

  if (sent) {
    return (
      <p role="status" className="mt-4 text-small text-ink-soft">
        אם הכתובת רשומה במערכת, נשלח אליה קישור לאיפוס הסיסמה.
      </p>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          await requestAdminPasswordReset(email);
          setSent(true);
        });
      }}
      className="mt-4 space-y-3 border-t border-rule pt-4"
    >
      <div>
        <label htmlFor={`${id}-reset-email`} className="field-label">
          כתובת המייל של חשבון הצוות
        </label>
        <input
          id={`${id}-reset-email`}
          type="email"
          dir="ltr"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field-input"
        />
      </div>
      <button type="submit" disabled={pending} className="btn btn-quiet w-full">
        {pending ? 'שולח…' : 'שליחת קישור לאיפוס'}
      </button>
    </form>
  );
}
