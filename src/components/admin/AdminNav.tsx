'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminIcon, type AdminIconName } from './AdminIcons';
import { hasPermission, type AdminPermission } from '@/lib/admin/permissions';
import type { ScreenAccess, ScreenKey } from '@/lib/admin/screens';
import type { UserRole } from '@/lib/supabase/types';

/**
 * גישה לפריט ניווט: רוב הפריטים (מודל 1.7) גדורים כעת דרך screen — אותה
 * מפת הרשאות פר-מסך שהעמוד עצמו בודק (requireScreenPermission), כולל
 * override מותאם אישית. ארבעת הפריטים המערכתיים (דשבורד/צוות/הגדרות/
 * יומן ביקורת/אבחון) עדיין לא מפתחות מסך משלהם ונשארים על הדגם הישן
 * (minRole הליניארי ו/או perm הדו-ממדי, permissions.ts).
 */
interface NavAccess {
  minRole?: UserRole;
  perm?: AdminPermission;
  screen?: ScreenKey;
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
 * "חנות" = כל מערכת המסחר, כולל הגדרות החנות (עברו לכאן מקבוצת הספרים
 * — דרישת בעל האתר בסבב 1.1: "הגדרות חנות תחת טאב חנות"). "ספרים" =
 * הקטלוג. [1.7] "חנות" מוצגת ראשונה, לפני "ספרים": הזמנה שממתינה
 * לטיפול היא דחופה בזמן בצורה שעדכון קטלוג אינו — הסדר במגירת הניווט
 * משקף סדר עדיפויות תפעולי, לא סדר בנייה היסטורי. "צוות והרשאות" —
 * מסך 15, מנהל-על בלבד.
 */
const ITEMS: NavEntry[] = [
  { type: 'link', href: '/admin', label: 'דשבורד', icon: 'dashboard', minRole: 'viewer', perm: 'store_view' },
  {
    type: 'group',
    label: 'חנות',
    icon: 'store',
    items: [
      { href: '/admin/orders', label: 'הזמנות', icon: 'orders', screen: 'orders' },
      { href: '/admin/customers', label: 'לקוחות', icon: 'authors', screen: 'customers' },
      { href: '/admin/inventory', label: 'מלאי ומחסנים', icon: 'inventory', screen: 'inventory' },
      { href: '/admin/shipping', label: 'שיטות אספקה', icon: 'shipping', screen: 'shipping' },
      { href: '/admin/coupons', label: 'קופונים', icon: 'coupon', screen: 'coupons' },
      { href: '/admin/books/sale-prices', label: 'מחירי מבצע', icon: 'coupon', screen: 'sale-prices' },
      { href: '/admin/reports', label: 'דוחות ורווחיות', icon: 'finance', screen: 'reports' },
      { href: '/admin/books/settings', label: 'הגדרות חנות', icon: 'settings', screen: 'store-settings' },
    ],
  },
  {
    type: 'group',
    label: 'ספרים',
    icon: 'books',
    // ללא שער עצמי — הקבוצה מוצגת אם ולו פריט אחד בתוכה גלוי (ראו visible למטה)
    items: [
      { href: '/admin/books', label: 'כל הספרים', icon: 'books', screen: 'books' },
      { href: '/admin/authors', label: 'מחברים', icon: 'authors', screen: 'authors' },
      { href: '/admin/categories', label: 'קטגוריות', icon: 'categories', screen: 'categories' },
      { href: '/admin/series', label: 'סדרות', icon: 'series', screen: 'series' },
      { href: '/admin/tags', label: 'תגיות', icon: 'tags', screen: 'tags' },
      { href: '/admin/books/homepage-shelf', label: 'מדף בעמוד הבית', icon: 'settings', screen: 'homepage-shelf' },
    ],
  },
  { type: 'link', href: '/admin/banners', label: 'באנרים', icon: 'banners', screen: 'banners' },
  { type: 'link', href: '/admin/events', label: 'אירועים', icon: 'events', screen: 'events' },
  { type: 'link', href: '/admin/activities', label: 'צירי פעילות', icon: 'activities', screen: 'activities' },
  { type: 'link', href: '/admin/pages', label: 'עמודי תוכן', icon: 'pages', screen: 'pages' },
  { type: 'link', href: '/admin/analytics', label: 'אנליטיקס', icon: 'analytics', screen: 'analytics' },
  {
    type: 'group',
    label: 'פניות מהאתר',
    icon: 'messages',
    items: [
      { href: '/admin/messages', label: 'פניות שהתקבלו', icon: 'messages', screen: 'messages' },
      { href: '/admin/contact-topics', label: 'תחומי פנייה', icon: 'tags', screen: 'contact-topics' },
      { href: '/admin/contact-fields', label: 'שדות מותאמים', icon: 'columns', screen: 'contact-fields' },
    ],
  },
  { type: 'link', href: '/admin/team', label: 'צוות והרשאות', icon: 'team', perm: 'users' },
  { type: 'link', href: '/admin/settings', label: 'הגדרות', icon: 'settings', minRole: 'manager' },
  { type: 'link', href: '/admin/audit-log', label: 'יומן ביקורת', icon: 'list', minRole: 'admin' },
  { type: 'link', href: '/admin/diagnostics', label: 'אבחון', icon: 'diagnostics', minRole: 'admin' },
];

const RANK: Record<UserRole, number> = {
  viewer: 0,
  picker: 1,
  seller: 2,
  store_manager: 2,
  editor: 3,
  manager: 4,
  admin: 5,
};

/**
 * screen ⇒ נבדק ישירות מול מפת ההרשאות (כולל override מותאם אישית) —
 * המקור היחיד שגם העמוד עצמו קורא ממנו. אחרת (ארבעת פריטי המערכת בלבד):
 * perm בלבד ⇒ ההרשאה מכריעה. minRole בלבד ⇒ הדירוג מכריע, אך תפקידי
 * החנות (מוכרן/מלקט/ניהול חנות) מוחרגים — דירוגם קיים רק לחסימת עמודי
 * תוכן בשרת, לא כזכות תוכן. שניהם ⇒ תפקידי חנות דרך ההרשאה, השאר דרך הדירוג.
 */
function canSee(role: UserRole, screenAccess: Record<ScreenKey, ScreenAccess>, access: NavAccess): boolean {
  if (access.screen) return screenAccess[access.screen]?.view ?? false;
  const storeRole = role === 'seller' || role === 'picker' || role === 'store_manager';
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

export function AdminNav({
  role,
  screenAccess,
}: {
  role: UserRole;
  screenAccess: Record<ScreenKey, ScreenAccess>;
}) {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  // ממוזכר כדי לזהות ניווט לעמוד חדש ולסגור תפריט פתוח — במהלך הרינדור
  // ולא באפקט, באותו דפוס בדיוק כמו BookFormTabs.tsx: זו "התאמת state
  // לפי props שהשתנו", לא סנכרון עם משהו חיצוני.
  const [seenPathname, setSeenPathname] = useState(pathname);
  const wrapRef = useRef<HTMLUListElement>(null);

  const visible = useMemo(
    () =>
      ITEMS.map((item) =>
        item.type === 'group'
          ? { ...item, items: item.items.filter((sub) => canSee(role, screenAccess, sub)) }
          : item,
      )
        // קישור בודד: השער שלו עצמו. קבוצה: גלויה אם ולו פריט אחד בתוכה גלוי —
        // לקבוצות "ספרים"/"חנות"/"פניות מהאתר" אין יותר שער עצמאי משלהן.
        .filter((item) => (item.type === 'group' ? item.items.length > 0 : canSee(role, screenAccess, item))),
    [role, screenAccess],
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
