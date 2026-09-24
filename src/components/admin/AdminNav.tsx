'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useSyncExternalStore } from 'react';
import { AdminIcon, type AdminIconName } from './AdminIcons';
import { hasPermission, type AdminPermission } from '@/lib/admin/permissions';
import type { ScreenAccess, ScreenKey } from '@/lib/admin/screens';
import type { UserRole } from '@/lib/supabase/types';
import { ROLE_RANK } from '@/lib/admin/roles';

/**
 * [1.31] Sidebar קבועה במקום קפסולת ניווט עליונה עם תפריטים נפתחים.
 * ~30 מסכים בשלוש קבוצות הפכו לצפופים מדי לשורה אחת אופקית; עמודה
 * קבועה עם כותרות קבוצה מציגה את כל הסדר בבת אחת. אותה בדיוק לוגיקת
 * הרשאות (canSee) כמו קודם — רק המבנה הוויזואלי (עמודה שטוחה במקום
 * תפריטים נפתחים) והרכיב שמרנדר אותו השתנו.
 *
 * ‏[1.41] הקבוצות מתקפלות. עמודה שטוחה עם ~30 קישורים אילצה גלילה
 * בעמודה עצמה, ובעבודה יומיומית משתמשים בקבוצה אחת או שתיים בכל פעם.
 * לכן:
 *
 *   • הקבוצה שבה נמצא המסך הנוכחי פתוחה תמיד. לא ייתכן שהקישור הפעיל
 *     מוסתר.
 *   • שאר הקבוצות נזכרות לפי בחירת המשתמש (localStorage), כך שמי
 *     שעובד בחנות אינו פותח אותה מחדש בכל מסך.
 *   • קבוצה מקופלת מציגה את מספר הפריטים שבה, כדי שהקיפול לא יסתיר
 *     מידע לגמרי.
 *
 * ‏"תוכן" מחולקת כאן לשתיים ("קטלוג" ו"תוכן האתר"): היא לבדה החזיקה
 * אחד-עשר מסכים, ובקבוצה כזו הקיפול כמעט אינו עוזר.
 *
 * הרשאות: ללא שינוי. ‏canSee נשארה כפי שהייתה, והקיפול הוא ויזואלי
 * בלבד — קבוצה שאין בה פריט מותר אינה מוצגת כלל.
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
    label: 'קטלוג',
    items: [
      { href: '/admin/books', label: 'כל הספרים', icon: 'books', screen: 'books', addHref: '/admin/books/new' },
      { href: '/admin/authors', label: 'מחברים', icon: 'authors', screen: 'authors', addHref: '/admin/authors/new' },
      { href: '/admin/categories', label: 'קטגוריות', icon: 'categories', screen: 'categories', addHref: '/admin/categories/new' },
      { href: '/admin/series', label: 'סדרות', icon: 'series', screen: 'series', addHref: '/admin/series/new' },
      { href: '/admin/tags', label: 'תגיות', icon: 'tags', screen: 'tags', addHref: '/admin/tags/new' },
    ],
  },
  {
    label: 'תוכן האתר',
    items: [
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
      { href: '/admin/email', label: 'דואר יוצא', icon: 'messages', screen: 'email' },
      { href: '/admin/monitoring', label: 'בריאות המערכת', icon: 'analytics', screen: 'monitoring' },
      { href: '/admin/team', label: 'צוות והרשאות', icon: 'team', perm: 'users' },
      { href: '/admin/settings', label: 'הגדרות', icon: 'settings', screen: 'org-settings' },
      { href: '/admin/audit-log', label: 'יומן ביקורת', icon: 'list', minRole: 'admin' },
      { href: '/admin/diagnostics', label: 'אבחון', icon: 'diagnostics', minRole: 'admin' },
    ],
  },
];


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
    return storeRole ? hasPermission(role, access.perm) : ROLE_RANK[role] >= ROLE_RANK[access.minRole];
  }
  if (access.minRole) return !storeRole && ROLE_RANK[role] >= ROLE_RANK[access.minRole];
  return false;
}

function matchesLink(pathname: string, href: string): boolean {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * זיכרון הקבוצות המקופלות.
 *
 * נקרא דרך useSyncExternalStore ולא דרך useState + useEffect: קריאת
 * ‏localStorage בזמן הרינדור הייתה מפיקה בשרת תוצאה אחרת מאשר בדפדפן
 * (hydration mismatch), והתיקון ב-effect היה setState מיד לאחר הרינדור
 * הראשון — כלומר רינדור כפול, ורגע שבו כל הקבוצות פתוחות ואז נסגרות.
 * ‏useSyncExternalStore הוא בדיוק הכלי למצב הזה: snapshot לשרת,
 * ‏snapshot לדפדפן, ומקור אמת אחד בלי state מקומי.
 *
 * הערך מוחזק במטמון לפי המחרוזת הגולמית, כי useSyncExternalStore דורש
 * snapshot יציב מבחינת זהות — מערך חדש בכל קריאה היה מפיל את הרכיב
 * ללופ רינדור אין-סופי.
 */
const COLLAPSE_KEY = 'admin-nav-collapsed';

const EMPTY: readonly string[] = [];

let cachedRaw: string | null | undefined;
let cachedValue: readonly string[] = EMPTY;

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // גם שינוי מלשונית אחרת — הניווט אמור להיראות אותו דבר בשתיהן.
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function getSnapshot(): readonly string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(COLLAPSE_KEY);
  } catch {
    // אחסון חסום (גלישה פרטית) — הקיפול עובד, פשוט לא נזכר.
    raw = null;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  cachedValue = parseCollapsed(raw);
  return cachedValue;
}

/** בשרת אין אחסון, ולכן אין קבוצה מקופלת — הכול פתוח ברינדור הראשון. */
function getServerSnapshot(): readonly string[] {
  return EMPTY;
}

function parseCollapsed(raw: string | null): readonly string[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const labels = parsed.filter((value): value is string => typeof value === 'string');
    return labels.length > 0 ? labels : EMPTY;
  } catch {
    return EMPTY;
  }
}

function writeCollapsed(next: readonly string[]): void {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
  } catch {
    // כנ"ל: נכשל בשקט, הקיפול עצמו כבר קרה.
  }
  // כתיבה עצמית אינה מפעילה את אירוע storage בלשונית הכותבת.
  cachedRaw = undefined;
  for (const listener of listeners) listener();
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

  /** הקבוצות המקופלות, לפי תווית. ראו הערת הזיכרון למעלה. */
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle(label: string) {
    writeCollapsed(
      collapsed.includes(label)
        ? collapsed.filter((entry) => entry !== label)
        : [...collapsed, label],
    );
  }

  return (
    <nav aria-label="ניווט ניהול" className="admin-sidebar-scroll">
      {visibleSections.map((section, index) => {
        const activeHere = section.items.some((item) => matchesLink(pathname, item.href));
        // הקבוצה שבה נמצא המסך הנוכחי פתוחה תמיד, גם אם המשתמש קיפל
        // אותה קודם: קישור פעיל שמוסתר הוא ניווט ששיקר.
        const open = activeHere || !section.label || !collapsed.includes(section.label);
        const listId = `admin-nav-group-${index}`;

        return (
          <div
            key={section.label ?? `section-${index}`}
            className="admin-sidebar-group"
            data-open={open ? 'true' : 'false'}
          >
            {section.label ? (
              <button
                type="button"
                onClick={() => toggle(section.label!)}
                aria-expanded={open}
                aria-controls={listId}
                className="admin-sidebar-group-label"
              >
                <span>{section.label}</span>
                {!open ? (
                  <span className="admin-sidebar-group-count">{section.items.length}</span>
                ) : null}
                <svg
                  viewBox="0 0 12 12"
                  aria-hidden="true"
                  className="admin-sidebar-group-chevron"
                  fill="none"
                >
                  <path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : null}

            {/* hidden ולא הסרה מה-DOM: מצב הפתיחה נשמר בלי לבנות מחדש,
                וקוראי מסך מקבלים את היחס הנכון דרך aria-expanded. */}
            <ul id={listId} hidden={!open} className="space-y-0.5">
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
        );
      })}
    </nav>
  );
}
