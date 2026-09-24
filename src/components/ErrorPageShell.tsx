import type { ReactNode } from 'react';
import { Container } from './Container';
import { Ornament } from './Ornament';

/**
 * ‏[1.41] המסגרת המשותפת לכל עמודי התקלה של האתר.
 *
 * עד כה כל מצב תקלה נראה אחרת: not-found היה כותרת ופסקה, error היה
 * כותרת ופסקה אחרות, ו-URL שלא נפל בכלל בתוך עץ השפה קיבל את עמוד
 * ברירת המחדל של Next — מסך לבן באנגלית, בלי כותרת, בלי פוטר ובלי שום
 * סימן שזה אותו אתר. זה מה שדווח כ"עמוד טכני שלא בעיצוב של האתר".
 *
 * המסגרת הזו היא המקום היחיד שקובע איך תקלה נראית, וכל מצב מעביר לה
 * את מה שמבדיל אותו: הכותרת, ההסבר, והפעולה שיש לעשות. ההבחנה בין
 * המצבים חשובה — "העמוד לא נמצא" ו"התוכן לא נטען" מחייבים את המבקר
 * לעשות שני דברים שונים, ולכן אינם יכולים לחלוק נוסח.
 *
 * ‏kind נקבע במפורש ולא נגזר מקוד ה-HTTP: אותו עמוד יכול להיות מוגש
 * גם כ-503 (תחזוקה) וגם כ-500 (תקלת רינדור), והנוסח נקבע לפי מה
 * שהמבקר צריך לדעת ולא לפי המספר.
 */
export function ErrorPageShell({
  kind,
  title,
  body,
  /** מזהה התקלה, כשיש. מוצג כדי שאפשר יהיה לצטט אותו בפנייה לתמיכה. */
  digest,
  /** כפתורים/קישורים. המצבים נבדלים בפעולה, ולכן היא נקבעת מחוץ לכאן. */
  actions,
  /** שורה נוספת בתחתית — למשל דרכי יצירת קשר בעמוד תחזוקה. */
  footnote,
}: {
  kind: 'not-found' | 'error' | 'maintenance';
  title: string;
  body: string;
  digest?: string | null;
  actions?: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <Container width="text" className="py-24 text-center lg:py-32">
      {/* הסמל של המצב. ‏aria-hidden — הכותרת שמתחתיו אומרת את אותו דבר
          בטקסט, וקורא מסך אינו צריך לשמוע אותו פעמיים. */}
      <div
        aria-hidden="true"
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cream-2 text-gold-deep"
      >
        <StatusMark kind={kind} />
      </div>

      <h1 className="mt-6 font-display text-[clamp(1.5rem,3.4vw,2.125rem)] text-ink">{title}</h1>
      <Ornament className="mx-auto" />
      <p className="mt-5 text-body leading-[1.9] text-ink-soft">{body}</p>

      {digest ? (
        // ‏dir="ltr" ובגופן קבוע-רוחב: זה מזהה אקראי, וב-RTL הוא נקרא
        // בסדר הפוך ומועתק שגוי.
        <p dir="ltr" className="mt-4 font-mono text-caption text-ink-soft">
          {digest}
        </p>
      ) : null}

      {actions ? <div className="mt-9 flex flex-wrap justify-center gap-3">{actions}</div> : null}
      {footnote ? <div className="mt-8 text-caption text-ink-soft">{footnote}</div> : null}
    </Container>
  );
}

function StatusMark({ kind }: { kind: 'not-found' | 'error' | 'maintenance' }) {
  if (kind === 'not-found') {
    // זכוכית מגדלת — "חיפשנו ולא מצאנו", ולא סמל אזהרה: לא נשבר דבר.
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 4 4" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'maintenance') {
    // מכשיר עבודה — עובדים על זה, ואין מה לנסות שוב מיד.
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path
          d="M14.5 3.5a4.5 4.5 0 0 0-5.9 5.9L3.5 14.5a2 2 0 0 0 2.8 2.8l5.1-5.1a4.5 4.5 0 0 0 5.9-5.9l-2.4 2.4-2.8-2.8z"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 4.5 21 20H3z" strokeLinejoin="round" />
      <path d="M12 10v4" strokeLinecap="round" />
      <circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none" />
    </svg>
  );
}
