'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { UserRole } from '@/lib/supabase/types';

const ITEMS: { href: string; label: string; minRole: UserRole }[] = [
  { href: '/admin', label: 'דשבורד', minRole: 'viewer' },
  { href: '/admin/banners', label: 'באנרים', minRole: 'viewer' },
  { href: '/admin/books', label: 'ספרים', minRole: 'viewer' },
  { href: '/admin/authors', label: 'מחברים', minRole: 'viewer' },
  { href: '/admin/events', label: 'אירועים', minRole: 'viewer' },
  { href: '/admin/activities', label: 'צירי פעילות', minRole: 'viewer' },
  { href: '/admin/pages', label: 'עמודי תוכן', minRole: 'viewer' },
  { href: '/admin/messages', label: 'פניות מהאתר', minRole: 'editor' },
  { href: '/admin/settings', label: 'הגדרות', minRole: 'admin' },
  { href: '/admin/diagnostics', label: 'אבחון', minRole: 'admin' },
];

const RANK: Record<UserRole, number> = { viewer: 0, editor: 1, admin: 2 };

export function AdminNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const visible = ITEMS.filter((item) => RANK[role] >= RANK[item.minRole]);

  return (
    <nav aria-label="ניווט ניהול" className="lg:w-52 lg:shrink-0">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 lg:block lg:space-y-0.5">
        {visible.map((item) => {
          const active =
            item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`block py-1.5 text-small transition-colors lg:border-s-2 lg:ps-3 ${
                  active
                    ? 'font-semibold text-burgundy lg:border-burgundy'
                    : 'text-ink-soft hover:text-burgundy lg:border-transparent'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
