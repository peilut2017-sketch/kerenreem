import Link from 'next/link';
import type { ReactNode } from 'react';

export function AdminHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-rule pb-5">
      <div>
        <h1 className="font-serif text-h2 text-ink">{title}</h1>
        {description ? <p className="mt-1 text-small text-muted">{description}</p> : null}
      </div>
      {action ? (
        <Link href={action.href} className="btn btn-solid">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

/** תגית מצב פרסום — טקסט, לא נקודה צבעונית שאין לה שם נגיש. */
export function PublishBadge({ published }: { published: boolean }) {
  return (
    <span
      className={`border px-2 py-0.5 text-caption ${
        published ? 'border-rule-strong text-muted' : 'border-burgundy text-burgundy'
      }`}
    >
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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-small">
        <thead>
          <tr className="border-y border-rule text-start">
            {columns.map((column) => (
              <th key={column} scope="col" className="py-2.5 pe-4 text-start font-semibold text-muted">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty ? <p className="py-8 text-muted">{empty}</p> : null}
    </div>
  );
}

export function AdminRow({ children }: { children: ReactNode }) {
  return <tr className="border-b border-rule align-top">{children}</tr>;
}

export function AdminCell({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`py-3 pe-4 ${className}`}>{children}</td>;
}
