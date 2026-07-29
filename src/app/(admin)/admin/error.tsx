'use client';

/**
 * גבול שגיאה לממשק הניהול.
 *
 * בלעדיו כל שגיאה במסכי הניהול חוזרת כ-500 בלי גוף, והפלטפורמה מציגה מסך
 * שגיאה כללי משלה עם מזהה מספרי בלבד. אז אין דרך לדעת מה נכשל: הודעת
 * השגיאה נשארת ביומני השרת, והמשתמש רואה "אירעה שגיאה" ולא יותר.
 *
 * ב-production ריאקט מסתיר את הודעת השגיאה ומשאיר digest — מזהה קצר
 * שמופיע גם ביומן השרת לצד ההודעה המלאה. הצגתו כאן היא מה שמאפשר לקשר
 * בין המסך שהמשתמש ראה לבין השורה הנכונה ביומן.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-[46rem] px-6 py-20">
      <h1 className="font-serif text-h2 text-ink">שגיאה בממשק הניהול</h1>
      <p className="mt-4 text-ink-soft">
        הפעולה לא הושלמה. אם השגיאה חוזרת, שלחו את הפרטים שלמטה — הם מזהים את
        התקלה ביומן השרת.
      </p>

      <dl className="mt-8 border-t border-rule text-small">
        {error.digest ? (
          <div className="flex flex-wrap gap-x-3 border-b border-rule py-2.5">
            <dt className="min-w-32 font-semibold">מזהה השגיאה</dt>
            <dd className="font-mono text-muted" dir="ltr">
              {error.digest}
            </dd>
          </div>
        ) : null}
        {error.message ? (
          <div className="flex flex-wrap gap-x-3 border-b border-rule py-2.5">
            <dt className="min-w-32 font-semibold">ההודעה</dt>
            <dd className="text-burgundy" dir="auto">
              {error.message}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-8 flex flex-wrap gap-4">
        <button type="button" onClick={reset} className="btn btn-quiet">
          נסו שוב
        </button>
        {/* טעינה מלאה במכוון, ולא next/link: העץ שנשבר עלול לשבור גם ניווט
            רך, והמטרה כאן היא רינדור נקי מהשרת. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/admin/diagnostics" className="btn btn-quiet">
          אבחון
        </a>
      </div>
    </div>
  );
}
