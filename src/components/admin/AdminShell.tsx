'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AdminIcon } from './AdminIcons';

/**
 * [1.31] מעטפת הפריסה: sidebar קבועה בדסקטופ, מגירה נגררת ממסך צר
 * במובייל. מצב הפתיחה חי כאן (לא ב-AdminNav) כי גם הכפתור בסרגל
 * העליון וגם המגירה עצמה צריכים לשתף אותו state.
 */
export function AdminShell({
  brand,
  nav,
  accountLabel,
  signOutButton,
  children,
}: {
  brand: ReactNode;
  nav: ReactNode;
  accountLabel: ReactNode;
  signOutButton: ReactNode;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);

  // [1.34] --admin-header-h: גובה הסרגל העליון כמשתנה CSS גלובלי, לאותה
  // מטרה בדיוק כמו --site-header-h הציבורי (SiteHeaderHeightVar.tsx) —
  // כרטיסי עריכה (BookForm וכו') זקוקים לו כדי להדביק את כותרת ה"שינויים
  // שלא נשמרו" שלהם מתחת לסרגל הזה, לא מתחתיו/עליו.
  useEffect(() => {
    const header = headerRef.current;
    if (!header || typeof ResizeObserver === 'undefined') return;

    const apply = (height: number) =>
      document.documentElement.style.setProperty('--admin-header-h', `${height}px`);

    apply(header.getBoundingClientRect().height);
    const observer = new ResizeObserver(([entry]) =>
      apply(entry.target.getBoundingClientRect().height ?? entry.contentRect.height),
    );
    observer.observe(header);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--admin-header-h');
    };
  }, []);
  // ניווט לעמוד חדש סוגר את המגירה — בלי זה קליק על קישור במובייל
  // משאיר אותה פתוחה מעל התוכן החדש. התאמת state לפי props שהשתנו
  // (pathname) בזמן הרינדור עצמו, לא ב-effect — אותו דפוס בדיוק כמו
  // AdminNav הישן (openGroup/seenPathname) ו-BookForm.tsx.
  const [seenPathname, setSeenPathname] = useState(pathname);
  if (pathname !== seenPathname) {
    setSeenPathname(pathname);
    setMobileOpen(false);
  }

  return (
    <div className="flex min-h-dvh bg-[var(--admin-canvas)]">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="סגירת תפריט הניווט"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      ) : null}

      {/* [1.31] הממשק כולו dir="rtl" קבוע (layout.tsx) — "תחילת" הניווט
          היא הצד הימני, ולכן start-0 (לא end-0). translate-x פיזי
          (לא לוגי) ולכן חיובי תמיד דוחף ימינה, מחוץ למסך, בלי תלות
          בכיווניות — בדיוק הכיוון הנכון להסתרה כשהעוגן בצד ימין. */}
      <aside
        className={`admin-sidebar fixed inset-y-0 start-0 z-50 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="admin-sidebar-brand">{brand}</div>
        {nav}
        <div className="admin-sidebar-footer">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-sidebar-link"
          >
            <AdminIcon name="external" className="h-4 w-4" />
            צפייה באתר
          </a>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header
          ref={headerRef}
          className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-white/90 px-4 py-3 backdrop-blur-md sm:px-6 lg:justify-end"
        >
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="פתיחת תפריט הניווט"
            className="admin-btn admin-btn-quiet admin-btn-icon lg:hidden"
          >
            <AdminIcon name="list" className="h-4.5 w-4.5" />
          </button>

          <div className="flex items-center gap-4">
            <Link
              href="/admin/account"
              className="hidden text-caption text-muted hover:text-ink sm:inline"
              title="החשבון שלי — שינוי מייל וסיסמה"
            >
              {accountLabel}
            </Link>
            {signOutButton}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[76rem] px-4 py-8 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
