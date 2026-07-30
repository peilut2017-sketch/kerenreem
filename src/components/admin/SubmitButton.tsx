'use client';

import { useFormStatus } from 'react-dom';

/**
 * לחצן שליחה שמראה שהוא נלחץ.
 *
 * useFormStatus קורא את מצב הטופס העוטף, ולכן הלחצן מגיב מיד עם השליחה
 * ולא ממתין לתשובת השרת. בלי זה אין שום סימן שהלחיצה נקלטה, והמשתמש לוחץ
 * שוב — מה ששולח את הטופס פעמיים.
 *
 * disabled מונע את השליחה הכפולה בפועל, ו-aria-disabled מודיע על כך
 * לקורא מסך; שינוי הטקסט מודיע לכל השאר.
 */
export function SubmitButton({
  children,
  pendingLabel = 'שומר…',
  className = 'btn btn-solid',
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={className}>
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Spinner />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export function Spinner({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`animate-spin ${className}`} fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
