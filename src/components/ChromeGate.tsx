'use client';

import { usePathname } from '@/i18n/navigation';

/**
 * [1.4] בורר המסגרת בין האתר הרגיל לקופה הרזה (ביקורת המימוש ב.17).
 *
 * layout.tsx הוא Server Component ואינו יודע את הנתיב הנוכחי; שני
 * העצים (header/checkoutHeader, footer שלם/כלום) מגיעים כבר מרונדרים
 * מהשרת כ-props, והבחירה כאן היא ויזואלית בלבד בצד הלקוח — לא בנייה
 * מחדש של מבנה הראוטים לשני root layouts נפרדים, שהייתה שינוי גדול
 * ומסוכן הרבה יותר מהבעיה שהיא פותרת.
 */
export function ChromeGate({
  header,
  checkoutHeader,
  footer,
  children,
}: {
  header: React.ReactNode;
  checkoutHeader: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isCheckout = pathname === '/checkout' || pathname.startsWith('/checkout/');

  return (
    <>
      {isCheckout ? checkoutHeader : header}
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      {isCheckout ? null : footer}
    </>
  );
}
