'use client';

import { useState, useTransition } from 'react';
import { revalidateAllPublicPages } from '@/lib/admin/actions';
import { Spinner } from './SubmitButton';

/**
 * רענון ידני של כל האתר הציבורי.
 *
 * למרות שהכפתור קורא ל-revalidatePath, אי אפשר להבטיח שהוא ישנה משהו:
 * נמדד ישירות שקריאה כזו — גם מ-Server Action וגם מ-Route Handler —
 * מסמנת את המטמון לרענון בלי שזה משתקף בפועל בבקשה הבאה מדפדפן חדש, על
 * הבנייה הנוכחית (Next.js 16.2.12, Turbopack). הרשת הביטחון האמיתית היא
 * חלון ה-ISR שקוצר לדקה בכל עמודי התוכן — תוכן חדש מובטח להופיע תוך דקה
 * לכל היותר, גם אם הכפתור הזה מתברר כלא-אפקטיבי בפריסה הנוכחית.
 */
export function RevalidateButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<'ok' | 'error' | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mb-8 border-s-2 border-rule-strong bg-cream-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-small text-ink-soft">
          כל עמוד ציבורי מתעדכן מעצמו תוך דקה לכל היותר — גם תוכן שנוסף ישירות
          ב-SQL Editor. הכפתור מנסה לזרז את זה, אך אם התוכן עדיין אינו מופיע
          מיד אחריו, פשוט המתינו לדקה; זו ההתנהגות הצפויה ולא תקלה.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setResult(null);
              setError(null);
              const response = await revalidateAllPublicPages();
              if (response.error) {
                setResult('error');
                setError(response.error);
              } else {
                setResult('ok');
              }
            })
          }
          className="admin-btn admin-btn-quiet inline-flex shrink-0 items-center gap-2 whitespace-nowrap"
        >
          {pending ? <Spinner className="h-3.5 w-3.5" /> : null}
          {pending ? 'מרענן…' : 'רענון האתר הציבורי עכשיו'}
        </button>
      </div>

      {result === 'ok' ? (
        <p role="status" className="mt-2 text-caption text-ink">
          הבקשה נשלחה. בדקו בלשונית חדשה — אם התוכן עדיין ישן, זה לא סימן
          לכשל; המתינו עד דקה ונסו שוב.
        </p>
      ) : null}
      {result === 'error' ? (
        <p role="alert" className="mt-2 text-caption text-burgundy">
          הרענון נכשל: {error}
        </p>
      ) : null}
    </div>
  );
}
