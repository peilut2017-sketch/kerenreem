'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminIcon, type AdminIconName } from './AdminIcons';
import type { UserRole } from '@/lib/supabase/types';

interface SubLink {
  href: string;
  label: string;
  icon: AdminIconName;
  minRole: UserRole;
}

interface LinkEntry {
  type: 'link';
  href: string;
  label: string;
  icon: AdminIconName;
  minRole: UserRole;
}

interface GroupEntry {
  type: 'group';
  label: string;
  icon: AdminIconName;
  minRole: UserRole;
  items: SubLink[];
}

type NavEntry = LinkEntry | GroupEntry;

/**
 * "ספרים" מרכז כאן את כל מה ששייך לקטלוג או לחנות — לא רק רשימת הספרים
 * עצמה, אלא גם מחברים, קטגוריות, סדרות, תגיות, והגדרות הקטלוג/חנות
 * שעברו לכאן מעמוד ההגדרות הכללי (ראו admin/books/settings). קודם לכן
 * אלה היו שישה פריטים נפרדים בשורת הניווט העליונה; איחוד תחת קבוצה אחת
 * גם מקצר את השורה וגם אומר במפורש "כל אלה שייכים לאותו נושא".
 */
const ITEMS: NavEntry[] = [
  { type: 'link', href: '/admin', label: 'דשבורד', icon: 'dashboard', minRole: 'viewer' },
  {
    type: 'group',
    label: 'ספרים',
    icon: 'books',
    minRole: 'viewer',
    items: [
      { href: '/admin/books', label: 'כל הספרים', icon: 'books', minRole: 'viewer' },
      { href: '/admin/authors', label: 'מחברים', icon: 'authors', minRole: 'viewer' },
      { href: '/admin/categories', label: 'קטגוריות', icon: 'categories', minRole: 'viewer' },
      { href: '/admin/series', label: 'סדרות', icon: 'series', minRole: 'viewer' },
      { href: '/admin/tags', label: 'תגיות', icon: 'tags', minRole: 'viewer' },
      { href: '/admin/books/settings', label: 'הגדרות קטלוג וחנות', icon: 'store', minRole: 'admin' },
    ],
  },
  { type: 'link', href: '/admin/banners', label: 'באנרים', icon: 'banners', minRole: 'viewer' },
  { type: 'link', href: '/admin/events', label: 'אירועים', icon: 'events', minRole: 'viewer' },
  { type: 'link', href: '/admin/activities', label: 'צירי פעילות', icon: 'activities', minRole: 'viewer' },
  { type: 'link', href: '/admin/pages', label: 'עמודי תוכן', icon: 'pages', minRole: 'viewer' },
  { type: 'link', href: '/admin/analytics', label: 'אנליטיקס', icon: 'analytics', minRole: 'editor' },
  { type: 'link', href: '/admin/messages', label: 'פניות מהאתר', icon: 'messages', minRole: 'editor' },
  { type: 'link', href: '/admin/settings', label: 'הגדרות', icon: 'settings', minRole: 'admin' },
  { type: 'link', href: '/admin/diagnostics', label: 'אבחון', icon: 'diagnostics', minRole: 'admin' },
];

const RANK: Record<UserRole, number> = { viewer: 0, editor: 1, admin: 2 };

function matchesLink(pathname: string, href: string): boolean {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  // ממוזכר כדי לזהות ניווט לעמוד חדש ולסגור תפריט פתוח — במהלך הרינדור
  // ולא באפקט, באותו דפוס בדיוק כמו BookFormTabs.tsx: זו "התאמת state
  // לפי props שהשתנו", לא סנכרון עם משהו חיצוני.
  const [seenPathname, setSeenPathname] = useState(pathname);
  const wrapRef = useRef<HTMLUListElement>(null);

  const visible = useMemo(
    () =>
      ITEMS.filter((item) => RANK[role] >= RANK[item.minRole])
        .map((item) =>
          item.type === 'group'
            ? { ...item, items: item.items.filter((sub) => RANK[role] >= RANK[sub.minRole]) }
            : item,
        )
        // קבוצה שהתרוקנה (כרגע לא קורה — לכל קבוצה יש לפחות פריט viewer) לא תוצג בכלל
        .filter((item) => item.type !== 'group' || item.items.length > 0),
    [role],
  );

  if (pathname !== seenPathname) {
    setSeenPathname(pathname);
    setOpenGroup(null);
  }

  useEffect(() => {
    if (!openGroup) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpenGroup(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenGroup(null);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openGroup]);

  return (
    <nav aria-label="ניווט ניהול">
      {/* flex + w-full דורסים את inline-flex של admin-nav-shell: בלעדיהם
          לרצועה אין רוחב עצמי לקבוע ביחס אליו overflow, וב-flex-wrap שהיה
          כאן קודם היא לא גולשת בצד אלא נשברת לכמה שורות — בכותרת sticky
          זה אומר גובה משתנה שבולע חלק ניכר ממסך הטלפון לצמיתות. שורה
          אחת שנגללת אופקית, כמו כרטיסיית טאבים בנייד, פותרת את שתיהן. */}
      <ul ref={wrapRef} className="admin-nav-shell flex w-full flex-nowrap gap-1 overflow-x-auto">
        {visible.map((item) => {
          if (item.type === 'link') {
            const active = matchesLink(pathname, item.href);
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`admin-nav-link ${active ? 'admin-nav-link-active' : ''}`}
                >
                  <AdminIcon name={item.icon} className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          }

          const active = item.items.some((sub) => matchesLink(pathname, sub.href));
          const open = openGroup === item.label;

          return (
            <li key={item.label} className="relative shrink-0">
              <button
                type="button"
                aria-haspopup="true"
                aria-expanded={open}
                onClick={() => setOpenGroup(open ? null : item.label)}
                className={`admin-nav-link ${active ? 'admin-nav-link-active' : ''}`}
              >
                <AdminIcon name={item.icon} className="h-4 w-4" />
                {item.label}
                <AdminIcon
                  name="chevron-down"
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                />
              </button>

              {open ? (
                <div className="admin-nav-dropdown" role="menu">
                  {item.items.map((sub, index) => {
                    const subActive = matchesLink(pathname, sub.href);
                    // הגדרות קטלוג/חנות מופרדת בקו — היא הגדרה, לא רשומת תוכן כמו השאר
                    const showDivider = sub.href === '/admin/books/settings' && index > 0;
                    return (
                      <div key={sub.href}>
                        {showDivider ? <div className="admin-nav-dropdown-divider" /> : null}
                        <Link
                          href={sub.href}
                          role="menuitem"
                          aria-current={subActive ? 'page' : undefined}
                          onClick={() => setOpenGroup(null)}
                          className={`admin-nav-dropdown-item ${subActive ? 'admin-nav-dropdown-item-active' : ''}`}
                        >
                          <AdminIcon name={sub.icon} className="h-4 w-4" />
                          {sub.label}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
