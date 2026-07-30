/**
 * מפעיל את המשבצת המקבילה @modal: כשמנווטים בתוך האתר מ-/admin/books אל
 * /admin/books/[id] או /admin/books/new, ה-Route המיירט בתוך @modal תופס
 * את הניווט ומציג מגירה מעל הרשימה במקום לעבור לעמוד מלא. ניווט ישיר
 * (רענון, קישור חיצוני) לא עובר דרך היירוט ומגיע לעמוד המלא הרגיל.
 */
export default function BooksLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
