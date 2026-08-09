'use client';

import { useEffect, useRef, useState } from 'react';
import { AdminIcon } from '@/components/admin/AdminIcons';
import { DOC_TYPE_LABELS } from '@/components/admin/orders/labels';
import type { CommerceDocument } from '@/lib/supabase/types';

export interface PrintMenuItem {
  href: string;
  label: string;
}

/**
 * [1.5] "הדפסה ▾" בעמוד ההזמנה: כל מסמכי ההזמנה במקום אחד, כולל קישור
 * למסמכי מורנינג (חשבונית/זיכוי) שכבר קיימים — לא מסמך פנימי מתחרה.
 */
export function PrintMenu({
  items,
  documents,
}: {
  items: PrintMenuItem[];
  documents: CommerceDocument[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const morningDocs = documents.filter((doc) => doc.status === 'created' && doc.download_url);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="admin-btn admin-btn-quiet"
      >
        <AdminIcon name="print" className="h-4 w-4" />
        הדפסה
        <AdminIcon name="chevron-down" className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div className="absolute end-0 z-20 mt-1 w-56 overflow-hidden rounded-[10px] border border-[var(--admin-border)] bg-white shadow-[var(--admin-shadow-hover)]">
          <ul>
            {items.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-2.5 text-start text-small text-ink hover:bg-[var(--admin-accent-soft)]"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              </li>
            ))}
            {morningDocs.length > 0 ? (
              <>
                <li className="border-t border-[var(--admin-border)]" />
                {morningDocs.map((doc) => (
                  <li key={doc.id}>
                    <a
                      href={doc.download_url ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-4 py-2.5 text-start text-small text-ink hover:bg-[var(--admin-accent-soft)]"
                      onClick={() => setOpen(false)}
                    >
                      {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type} (מורנינג)
                    </a>
                  </li>
                ))}
              </>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
