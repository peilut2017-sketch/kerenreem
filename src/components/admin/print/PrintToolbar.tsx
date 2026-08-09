'use client';

/**
 * [1.5] סרגל מסך-בלבד (no-print): כפתור הדפסה + חזרה. לא מופיע בפועל
 * בהדפסה — print.css מסתיר את .print-toolbar תחת @media print.
 */
export function PrintToolbar({ title, backHref }: { title: string; backHref: string }) {
  return (
    <div className="print-toolbar">
      <span>{title}</span>
      <div className="flex items-center gap-2">
        <a href={backHref} className="no-underline">
          <button type="button">חזרה</button>
        </a>
        <button type="button" onClick={() => window.print()}>
          הדפסה
        </button>
      </div>
    </div>
  );
}
