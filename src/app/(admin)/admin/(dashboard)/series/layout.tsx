/**
 * מפעיל את המשבצת המקבילה @modal: ניווט פנימי אל /new נתפס על ידי
 * ה-Route המיירט ומציג כרטיס צף מעל הרשימה במקום מעבר לעמוד מלא.
 * ניווט ישיר (רענון, קישור חיצוני) מגיע לעמוד המלא הרגיל.
 */
export default function EntityLayout({
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
