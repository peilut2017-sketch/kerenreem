import '../../print.css';

/**
 * [1.5] מחוץ ל-(dashboard) בכוונה: בלי AdminNav/Sidebar/כותרת, רק
 * print.css. ה-<html>/<body> מגיעים מ-admin/layout.tsx (השורש המשותף).
 */
export default function OrderPrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
