import type { Metadata } from 'next';
import { Frank_Ruhl_Libre, Assistant } from 'next/font/google';
import '../../globals.css';

const frank = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500'],
  variable: '--font-frank',
  display: 'swap',
});

const assistant = Assistant({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '600', '700'],
  variable: '--font-assistant',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ניהול · מכון קרן רא״ם',
  // ממשק פנימי — לא נכנס למנועי חיפוש
  robots: { index: false, follow: false },
};

/**
 * ממשק הניהול הוא עברי בלבד ולכן אינו עובר דרך ניתוב השפות.
 * זהו root layout נפרד (route group), עם <html> משלו.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${frank.variable} ${assistant.variable}`}>
      <body className="bg-paper">{children}</body>
    </html>
  );
}
