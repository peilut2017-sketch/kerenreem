'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { AdminIcon, type AdminIconName } from './AdminIcons';
import { hasPermission, type AdminPermission } from '@/lib/admin/permissions';
import type { ScreenAccess, ScreenKey } from '@/lib/admin/screens';
import type { UserRole } from '@/lib/supabase/types';

/**
 * [1.31] Sidebar קבועה במקום קפסולת ניווט עליונה עם תפריטים נפתחים.
 * ~30 מסכים בשלוש קבוצות הפכו לצפופים מדי לשורה אחת אופקית; עמודה
 * קבועה עם כותרות קבוצה מציגה את כל הסדר בבת אחת. אותה בדיוק לוגיקת
 * הרשאות (canSee) כמו קודם — רק המבנה הוויזואלי (עמודה שטוחה במקום
 * תפריטים נפתחים) והרכיב שמרנדר אותו השתנו.
 */
interface NavAccess {
  minRole?: UserRole;
  perm?: AdminPermission;
  screen?: ScreenKey;
}

interface LinkEntry extends NavAccess {
  href: string;
  label: string;
  icon: AdminIconName;
  addHref?: string;
}

interface Section {
  label: string | null;
  items: LinkEntry[];
}

const SECTIONS: Section[] = [
  {
    label: null,
    items: [{ href: '/admin', label: 'דשבורד', icon: 'dashboard', minRole: 'viewer', perm: 'store_view' }],
  },
  {
    label: 'תוכן',
    items: [
      { href: '/admin/books', label: 'כל הספרים', icon: 'books', screen: 'books', addHref: '/admin/books/new' },
      { href: '/admin/authors', label: 'מחברים', icon: 'authors', screen: 'authors', addHref: '/admin/authors/new' },
      { href: '/admin/categories', label: 'קטגוריות', icon: 'categories', screen: 'categories', addHref: '/admin/categories/new' },
      { href: '/admin/series', label: 'סדרות', icon: 'series', screen: 'series', addHref: '/admin/series/new' },
      { href: '/admin/tags', label: 'תגיות', icon: 'tags', screen: 'tags', addHref: '/admin/tags/new' },
      { href: '/admin/books/homepage-shelf', label: 'מדף בעמוד הבית', icon: 'settings', screen: 'homepage-shelf' },
      { href: '/admin/banners', label: 'באנרים', icon: 'banners', screen: 'banners' },
      { href: '/admin/events', label: 'אירועים', icon: 'events', screen: 'events' },
      { href: '/admin/activities', label: 'צירי פעילות', icon: 'activities', screen: 'activities' },
      { href: '/admin/pages', label: 'עמודי תוכן', icon: 'pages', screen: 'pages' },
      { href: '/admin/analytics', label: 'אנליטיקס', icon: 'analytics', screen: 'analytics' },
    ],
  },
  {
    label: 'חנות',
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
    label: 'פניות מהאתר',
    items: [
      { href: '/admin/messages', label: 'פניות שהתקבלו', icon: 'messages', screen: 'messages' },
      { href: '/admin/contact-topics', label: 'תחומי פנייה', icon: 'tags', screen: 'contact-topics' },
      { href: '/admin/contact-fields', label: 'שדות מותאמים', icon: 'columns', screen: 'contact-fields' },
    ],
  },
  {
    label: 'מערכת',
    items: [
      { href: '/admin/media-library', label: 'ספריית מדיה', icon: 'image', screen: 'media-library' },
      { href: '/admin/team', label: 'צוות והרשאות', icon: 'team', perm: 'users' },
      { href: '/admin/settings', label: 'הגדרות', icon: 'settings', minRole: 'manager' },
      { href: '/admin/audit-log', label: 'יומן ביקורת', icon: 'list', minRole: 'admin' },
      { href: '/admin/diagnostics', label: 'אבחון', icon: 'diagnostics', minRole: 'admin' },
    ],
  },
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
 * המקור היחיד שגם העמוד עצמו קורא ממנו. אחרת (חמשת פריטי המערכת בלבד):
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
  unreadMessages = 0,
}: {
  role: UserRole;
  screenAccess: Record<ScreenKey, ScreenAccess>;
  /** [1.11] מספר הפניות החדשות — תג על "פניות שהתקבלו". */
  unreadMessages?: number;
}) {
  const pathname = usePathname();

  const visibleSections = useMemo(
    () =>
      SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) => canSee(role, screenAccess, item)),
      })).filter((section) => section.items.length > 0),
    [role, screenAccess],
  );

  return (
    <nav aria-label="ניווט ניהול" className="admin-sidebar-scroll">
      {visibleSections.map((section, index) => (
        <div key={section.label ?? `section-${index}`} className="admin-sidebar-group">
          {section.label ? <p className="admin-sidebar-group-label">{section.label}</p> : null}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = matchesLink(pathname, item.href);
              const badge = item.href === '/admin/messages' && unreadMessages > 0 ? unreadMessages : null;
              const canAdd = Boolean(item.addHref && item.screen && (screenAccess[item.screen]?.edit ?? false));
              return (
                <li key={item.href} className={canAdd ? 'flex items-stretch gap-1' : undefined}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`admin-sidebar-link min-w-0 flex-1 ${active ? 'admin-sidebar-link-active' : ''}`}
                  >
                    <AdminIcon name={item.icon} className="h-4 w-4" />
                    <span className="truncate">{item.label}</span>
                    {badge ? (
                      <span className="admin-sidebar-link-badge" aria-label={`${badge} פניות חדשות`}>
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                  {canAdd ? (
                    <Link
                      href={item.addHref!}
                      aria-label={`${item.label} — הוספה מהירה`}
                      title={`${item.label} — הוספה מהירה`}
                      className="admin-sidebar-link shrink-0 px-2"
                    >
                      <AdminIcon name="plus" className="h-4 w-4" />
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
