'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AdminRecordList, type AdminRecordColumn } from '@/components/admin/AdminRecordList';
import {
  DOCUMENT_STATE_LABELS,
  ORDER_STATE_LABELS,
  PAYMENT_STATE_LABELS,
  FULFILLMENT_STATE_LABELS,
  stateBadgeClass,
} from './labels';
import { formatPrice } from '@/lib/commerce/pricing';
import type { Order } from '@/lib/supabase/types';

import { formatAdminDate } from '@/lib/admin/reporting/format';
/**
 * [1.5] בחירה מרובה + פעולות מרוכזות — האפיון כבר הכיר Bulk actions
 * ברשימת הספרים (BooksDataGrid); כאן אותו דפוס לרשימת ההזמנות, כדי
 * שהדפסת ליקוט מרוכז/תעודות/מדבקות לא תדרוש לפתוח כל הזמנה בנפרד.
 * [1.5] הטבלה עצמה עברה ל-AdminRecordList — טבלה מ-md ומעלה, כרטיסים
 * מתחת, כדי שרשימת ההזמנות תהיה שמישה מהטלפון בלי גלילה אופקית.
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

  const columns: AdminRecordColumn<Order>[] = [
    {
      key: 'number',
      header: '#',
      cardHidden: true,
      render: (order) => (
        <span className="font-semibold tabular-nums">
          {order.order_number}
          {order.is_gift ? <span className="ms-1.5" title="הזמנת מתנה">🎁</span> : null}
          {order.tags?.includes('amount-mismatch') ? (
            <span className="ms-1.5" title="פער סכומים — דורש טיפול">⚠️</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'customer',
      header: 'לקוח',
      render: (order) => (
        <>
          <div>{order.contact_name ?? '—'}</div>
          <div dir="ltr" className="text-caption text-muted">{order.contact_phone}</div>
        </>
      ),
    },
    {
      key: 'date',
      header: 'תאריך',
      className: 'text-muted',
      render: (order) =>
        formatAdminDate(order.created_at, 'dateTime'),
    },
    {
      key: 'total',
      header: 'סכום',
      className: 'tabular-nums',
      render: (order) => formatPrice(order.total, 'he', { alwaysAgorot: true }),
    },
    {
      key: 'state',
      header: 'הזמנה',
      cardHidden: true,
      render: (order) => <Badge value={order.state} labels={ORDER_STATE_LABELS} />,
    },
    {
      key: 'payment',
      header: 'תשלום',
      render: (order) => <Badge value={order.payment_state} labels={PAYMENT_STATE_LABELS} />,
    },
    {
      key: 'fulfillment',
      header: 'אספקה',
      render: (order) => <Badge value={order.fulfillment_state} labels={FULFILLMENT_STATE_LABELS} />,
    },
    {
      key: 'document',
      header: 'מסמך',
      className: 'text-caption text-muted',
      render: (order) => DOCUMENT_STATE_LABELS[order.document_state] ?? order.document_state,
    },
    {
      key: 'channel',
      header: 'ערוץ',
      className: 'text-caption text-muted',
      render: (order) => (order.channel === 'web' ? 'אתר' : order.channel === 'phone' ? 'טלפון' : 'ידני'),
    },
  ];

  return (
    <div>
      {selected.size > 0 ? (
        <div className="admin-card mb-3 flex flex-wrap items-center gap-3 bg-[var(--admin-accent-soft)] px-4 py-2.5 text-small">
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
            <Link
              href={`/admin/orders/print/delivery-report?ids=${idsParam}`}
              className="admin-btn admin-btn-quiet"
              target="_blank"
            >
              דוח מסירה לשליח
            </Link>
          </div>
          <button type="button" onClick={() => setSelected(new Set())} className="ms-auto text-caption text-muted underline">
            ביטול בחירה
          </button>
        </div>
      ) : null}
      <AdminRecordList
        rows={orders}
        columns={columns}
        getRowKey={(order) => order.id}
        href={(order) => `/admin/orders/${order.id}`}
        renderCardTitle={(order) => (
          <>
            #{order.order_number}
            {order.is_gift ? <span className="ms-1.5" title="הזמנת מתנה">🎁</span> : null}
            {order.tags?.includes('amount-mismatch') ? (
              <span className="ms-1.5" title="פער סכומים — דורש טיפול">⚠️</span>
            ) : null}
          </>
        )}
        renderCardBadge={(order) => <Badge value={order.state} labels={ORDER_STATE_LABELS} />}
        selection={{
          isSelected: (order) => selected.has(order.id),
          onToggle: (order) => toggle(order.id),
          onToggleAll: toggleAll,
          allSelected,
          label: (order) => `בחירת הזמנה #${order.order_number}`,
        }}
        minWidthClassName="min-w-[60rem]"
        emptyMessage="אין הזמנות להצגה."
      />
    </div>
  );
}

function Badge({ value, labels }: { value: string; labels: Record<string, string> }) {
  return <span className={`admin-badge ${stateBadgeClass(value)}`}>{labels[value] ?? value}</span>;
}
