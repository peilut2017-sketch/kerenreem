'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  DOCUMENT_STATE_LABELS,
  ORDER_STATE_LABELS,
  PAYMENT_STATE_LABELS,
  FULFILLMENT_STATE_LABELS,
  stateBadgeClass,
} from './labels';
import { formatPrice } from '@/lib/commerce/pricing';
import type { Order } from '@/lib/supabase/types';

/**
 * [1.5] בחירה מרובה + פעולות מרוכזות — האפיון כבר הכיר Bulk actions
 * ברשימת הספרים (BooksDataGrid); כאן אותו דפוס לרשימת ההזמנות, כדי
 * שהדפסת ליקוט מרוכז/תעודות/מדבקות לא תדרוש לפתוח כל הזמנה בנפרד.
 */
export function OrdersTable({ orders }: { orders: Order[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => (current.size === orders.length ? new Set() : new Set(orders.map((o) => o.id))));
  }

  const idsParam = [...selected].join(',');
  const allSelected = orders.length > 0 && selected.size === orders.length;

  return (
    <div className="admin-card admin-table-wrap">
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-rule bg-[var(--admin-accent-soft)] px-4 py-2.5 text-small">
          <span className="font-semibold text-ink">{selected.size} הזמנות נבחרו</span>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/orders/print/picking-list?ids=${idsParam}`}
              className="admin-btn admin-btn-quiet"
              target="_blank"
            >
              ליקוט מרוכז
            </Link>
            <Link
              href={`/admin/orders/print/packing-slips?ids=${idsParam}`}
              className="admin-btn admin-btn-quiet"
              target="_blank"
            >
              {selected.size} תעודות משלוח
            </Link>
            <Link
              href={`/admin/orders/print/shipping-labels?ids=${idsParam}`}
              className="admin-btn admin-btn-quiet"
              target="_blank"
            >
              {selected.size} מדבקות משלוח
            </Link>
            <Link
              href={`/admin/orders/print/order-sheets?ids=${idsParam}`}
              className="admin-btn admin-btn-quiet"
              target="_blank"
            >
              {selected.size} דפי הזמנה
            </Link>
          </div>
          <button type="button" onClick={() => setSelected(new Set())} className="ms-auto text-caption text-muted underline">
            ביטול בחירה
          </button>
        </div>
      ) : null}
      <table className="admin-table w-full min-w-[60rem] text-small">
        <thead>
          <tr className="border-b border-rule text-start text-caption text-muted">
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="בחירת כל ההזמנות בעמוד"
                className="accent-[var(--admin-accent)]"
              />
            </th>
            <th className="px-4 py-3 text-start">#</th>
            <th className="px-4 py-3 text-start">לקוח</th>
            <th className="px-4 py-3 text-start">תאריך</th>
            <th className="px-4 py-3 text-start">סכום</th>
            <th className="px-4 py-3 text-start">הזמנה</th>
            <th className="px-4 py-3 text-start">תשלום</th>
            <th className="px-4 py-3 text-start">אספקה</th>
            <th className="px-4 py-3 text-start">מסמך</th>
            <th className="px-4 py-3 text-start">ערוץ</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr
              key={order.id}
              className={`border-b border-rule/60 transition-colors hover:bg-cream-2/50 ${
                selected.has(order.id) ? 'bg-[var(--admin-accent-soft)]' : ''
              }`}
            >
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.has(order.id)}
                  onChange={() => toggle(order.id)}
                  aria-label={`בחירת הזמנה #${order.order_number}`}
                  className="accent-[var(--admin-accent)]"
                />
              </td>
              <td className="px-4 py-3 font-semibold tabular-nums">
                <Link href={`/admin/orders/${order.id}`} className="text-[var(--admin-accent)] hover:underline">
                  {order.order_number}
                </Link>
                {order.is_gift ? <span className="ms-1.5" title="הזמנת מתנה">🎁</span> : null}
                {order.tags?.includes('amount-mismatch') ? (
                  <span className="ms-1.5" title="פער סכומים — דורש טיפול">⚠️</span>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <div>{order.contact_name ?? '—'}</div>
                <div dir="ltr" className="text-caption text-muted">{order.contact_phone}</div>
              </td>
              <td className="px-4 py-3 text-muted">
                {new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(new Date(order.created_at))}
              </td>
              <td className="px-4 py-3 tabular-nums">{formatPrice(order.total, 'he', { alwaysAgorot: true })}</td>
              <td className="px-4 py-3"><Badge value={order.state} labels={ORDER_STATE_LABELS} /></td>
              <td className="px-4 py-3"><Badge value={order.payment_state} labels={PAYMENT_STATE_LABELS} /></td>
              <td className="px-4 py-3"><Badge value={order.fulfillment_state} labels={FULFILLMENT_STATE_LABELS} /></td>
              <td className="px-4 py-3 text-caption text-muted">{DOCUMENT_STATE_LABELS[order.document_state] ?? order.document_state}</td>
              <td className="px-4 py-3 text-caption text-muted">
                {order.channel === 'web' ? 'אתר' : order.channel === 'phone' ? 'טלפון' : 'ידני'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Badge({ value, labels }: { value: string; labels: Record<string, string> }) {
  return <span className={`admin-badge ${stateBadgeClass(value)}`}>{labels[value] ?? value}</span>;
}
