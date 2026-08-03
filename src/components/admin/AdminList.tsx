import Link from 'next/link';
import type { ReactNode } from 'react';
import { AdminIcon, type AdminIconName } from './AdminIcons';

interface HeaderAction {
  href: string;
  label: string;
  icon?: AdminIconName;
  /** 'solid' (ברירת מחדל) לפעולה הראשית, 'quiet' לפעולה משנית לצדה */
  variant?: 'solid' | 'quiet';
}

export function AdminHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  /** פעולה אחת, או כמה פעולות זו לצד זו (למשל "ספר חדש" + "הגדרות קטלוג") */
  action?: HeaderAction | HeaderAction[];
}) {
  const actions = action ? (Array.isArray(action) ? action : [action]) : [];

  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-serif text-h2 text-ink">{title}</h1>
        {description ? <p className="mt-1.5 text-small text-muted">{description}</p> : null}
      </div>
      {actions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2.5">
          {actions.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-btn ${item.variant === 'quiet' ? 'admin-btn-quiet' : 'admin-btn-solid'}`}
            >
              {item.icon ? <AdminIcon name={item.icon} className="h-4 w-4" /> : null}
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** תגית מצב פרסום — פיל עם נקודה, לא רק צבע טקסט. */
export function PublishBadge({ published }: { published: boolean }) {
  return (
    <span className={`admin-badge ${published ? 'admin-badge-success' : 'admin-badge-warning'}`}>
      <span className="admin-badge-dot" aria-hidden="true" />
      {published ? 'מפורסם' : 'טיוטה'}
    </span>
  );
}

export function AdminTable({
  columns,
  children,
  empty,
}: {
  columns: string[];
  children: ReactNode;
  empty?: string;
}) {
  return (
    <div className="admin-table-wrap overflow-x-auto">
      <table className="admin-table min-w-[36rem]">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty ? <p className="px-4 py-10 text-center text-muted">{empty}</p> : null}
    </div>
  );
}

export function AdminRow({ children }: { children: ReactNode }) {
  return <tr>{children}</tr>;
}

export function AdminCell({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={className}>{children}</td>;
}
