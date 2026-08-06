'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminIcon, type AdminIconName } from './AdminIcons';
import { hasPermission, type AdminPermission } from '@/lib/admin/permissions';
import type { UserRole } from '@/lib/supabase/types';

/**
 * גישה לפריט ניווט — שני צירים (מודל 1.1, פרק 19): צד התוכן נשען על
 * הדירוג הליניארי (minRole), וצד החנות על הרשאה דו-ממדית (perm) — כך
 * עורך תוכן אינו רואה את קבוצת החנות כלל, ומוכרן אינו רואה תוכן.
 */
interface NavAccess {
  minRole?: UserRole;
  perm?: AdminPermission;
}

interface SubLink extends NavAccess {
  href: string;
  label: string;
  icon: AdminIconName;
}

interface LinkEntry extends NavAccess {
  type: 'link';
  href: string;
  label: string;
  icon: AdminIconName;
}

interface GroupEntry extends NavAccess {
  type: 'group';
  label: string;
  icon: AdminIconName;
  items: SubLink[];
}

type NavEntry = LinkEntry | GroupEntry;

/**
 * "ספרים" = הקטלוג; "חנות" = כל מערכת המסחר, כולל הגדרות החנות (עברו
 * לכאן מקבוצת הספרים — דרישת בעל האתר בסבב 1.1: "הגדרות חנות תחת טאב
 * חנות"). "צוות והרשאות" — מסך 15, מנהל-על בלבד.
 */
const ITEMS: NavEntry[] = [
  { type: 'link', href: '/admin', label: 'דשבורד', icon: 'dashboard', minRole: 'viewer', perm: 'store_view' },
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
    ],
  },
  {
    type: 'group',
    label: 'חנות',
    icon: 'store',
    perm: 'store_view',
    items: [
      { href: '/admin/orders', label: 'הזמנות', icon: 'orders', perm: 'store_view' },
      { href: '/admin/inventory', label: 'מלאי ומחסנים', icon: 'inventory', perm: 'store_view' },
      { href: '/admin/shipping', label: 'שיטות אספקה', icon: 'shipping', perm: 'finance' },
      { href: '/admin/coupons', label: 'קופונים', icon: 'coupon', perm: 'finance' },
      { href: '/admin/reports', label: 'דוחות ורווחיות', icon: 'finance', perm: 'finance' },
      { href: '/admin/books/settings', label: 'הגדרות חנות', icon: 'settings', perm: 'finance' },
    ],
  },
  { type: 'link', href: '/admin/banners', label: 'באנרים', icon: 'banners', minRole: 'viewer', perm: 'content' },
  { type: 'link', href: '/admin/events', label: 'אירועים', icon: 'events', minRole: 'viewer', perm: 'content' },
  { type: 'link', href: '/admin/activities', label: 'צירי פעילות', icon: 'activities', minRole: 'viewer', perm: 'content' },
  { type: 'link', href: '/admin/pages', label: 'עמודי תוכן', icon: 'pages', minRole: 'viewer', perm: 'content' },
  { type: 'link', href: '/admin/analytics', label: 'אנליטיקס', icon: 'analytics', minRole: 'editor' },
  {
    type: 'group',
    label: 'פניות מהאתר',
    icon: 'messages',
    minRole: 'editor',
    items: [
      { href: '/admin/messages', label: 'פניות שהתקבלו', icon: 'messages', minRole: 'editor' },
      { href: '/admin/contact-topics', label: 'תחומי פנייה', icon: 'tags', minRole: 'editor' },
      { href: '/admin/contact-fields', label: 'שדות מותאמים', icon: 'columns', minRole: 'editor' },
    ],
  },
  { type: 'link', href: '/admin/team', label: 'צוות והרשאות', icon: 'team', perm: 'users' },
  { type: 'link', href: '/admin/settings', label: 'הגדרות', icon: 'settings', minRole: 'admin' },
  { type: 'link', href: '/admin/diagnostics', label: 'אבחון', icon: 'diagnostics', minRole: 'admin' },
];

const RANK: Record<UserRole, number> = {
  viewer: 0,
  picker: 1,
  seller: 2,
  editor: 3,
  manager: 4,
  admin: 5,
};

/**
 * perm בלבד ⇒ ההרשאה מכריעה. minRole בלבד ⇒ הדירוג מכריע, אך תפקידי
 * החנות (מוכרן/מלקט) מוחרגים — דירוגם קיים רק לחסימת עמודי תוכן בשרת,
 * לא כזכות תוכן. שניהם ⇒ תפקידי חנות דרך ההרשאה, השאר דרך הדירוג.
 */
function canSee(role: UserRole, access: NavAccess): boolean {
  const storeRole = role === 'seller' || role === 'picker';
  if (access.perm && !access.minRole) return hasPermission(role, access.perm);
  if (access.perm && access.minRole) {
    return storeRole ? hasPermission(role, access.perm) : RANK[role] >= RANK[access.minRole];
  }
  if (access.minRole) return !storeRole && RANK[role] >= RANK[access.minRole];
  return false;
}

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
      ITEMS.filter((item) => canSee(role, item))
        .map((item) =>
          item.type === 'group'
            ? { ...item, items: item.items.filter((sub) => canSee(role, sub)) }
            : item,
        )
        // קבוצה שהתרוקנה לא תוצג בכלל
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
      {/*
        בלי overflow-x-auto בכוונה — ולא רק overflow-y-visible לצדו: לפי
        כלל ה-CSS, כשציר overflow אחד אינו visible, הדפדפן *מחשב* את
        הציר השני ל-auto תמיד, גם אם visible נקבע לו במפורש. אין דרך
        "לבטל" את זה עם עוד קלאס overflow-y — ניסיתי (ראו היסטוריית
        git) וזה לא עבד: נבדק ישירות עם getComputedStyle, overflowY
        נשאר 'auto' ולא 'visible', וזה מה שקטע את התפריט הנפתח של קבוצת
        "ספרים" (שממוקם absolute ויוצא מתחת לקצה ה-ul). הפתרון היחיד
        האמיתי הוא לא לקבוע overflow-x בכלל — flex-wrap כבר מטפל בעודף
        פריטים במסך צר על ידי מעבר לשורה נוספת, בלי צורך בגלילה אופקית.
      */}
      <ul ref={wrapRef} className="admin-nav-shell flex-wrap gap-1">
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
