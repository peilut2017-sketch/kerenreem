import type { Metadata } from 'next';
import { FONT_VARIABLES } from '@/lib/fonts';
import { CustomFontsStyle } from '@/components/CustomFontsStyle';
import { SmoothScroll } from '@/components/SmoothScroll';
import { PointerGlow } from '@/components/PointerGlow';
import '../../globals.css';
import './admin.css';

export const metadata: Metadata = {
  title: 'ניהול · מכון קרן רא״ם',
  // ממשק פנימי — לא נכנס למנועי חיפוש
  robots: { index: false, follow: false },
  // אותו אייקון דינמי כמו באתר הציבורי — ראו src/app/site-icon/route.ts
  icons: { icon: '/site-icon' },
};

/**
 * ממשק הניהול הוא עברי בלבד ולכן אינו עובר דרך ניתוב השפות.
 * זהו root layout נפרד (route group), עם <html> משלו.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={FONT_VARIABLES}>
      <head>
        {/* גופנים מותקנים — גם בניהול, כדי שהעורך יציג אותם בתצוגה נכונה */}
        <CustomFontsStyle />
      </head>
      <body className="bg-cream">
        {/* אותה גלילה חלקה כמו באתר הציבורי. טבלאות רחבות גולשות אופקית
            בלבד, ואזורי הגלילה האנכיים מסומנים data-lenis-prevent. */}
        <SmoothScroll />
        <PointerGlow />
        {children}
      </body>
    </html>
  );
}
