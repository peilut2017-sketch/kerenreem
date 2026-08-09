'use client';

import { useMemo, useState, useTransition } from 'react';
import { Drawer } from '@/components/Drawer';
import { refundOrder } from '@/lib/admin/orders-actions';
import { formatPrice } from '@/lib/commerce/pricing';

export interface RefundableItem {
  key: string;
  title: string;
  quantity: number;
  lineTotal: number;
}

type Step = 'items' | 'reason' | 'confirm' | 'done';

/**
 * [1.5] אשף זיכוי בן ארבעה צעדים, במקום כפתור + שדה סכום חופשי (ביקורת
 * ג.22): בחירת פריטים → סיבה → סיכום מפורש ("אתה עומד לזכות X ₪ עבור...")
 * → תוצאה. refundOrder עצמו עדיין מקבל סכום שטוח בלבד — אין מעקב זיכוי
 * פר-פריט במסד — אז בחירת הפריטים כאן היא כלי חישוב ושקיפות לצוות,
 * לא נתון שנשמר; "סכום מותאם אישית" נשאר כדי לא לחסום זיכוי חלקי/רצון
 * טוב שלא תואם בדיוק שורת פריט.
 */
export function RefundDialog({
  orderId,
  refundable,
  items,
  shippingTotal,
  onDone,
}: {
  orderId: string;
  refundable: number;
  items: RefundableItem[];
  shippingTotal: number;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('items');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [includeShipping, setIncludeShipping] = useState(false);
  const [customAmount, setCustomAmount] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [refundToken, setRefundToken] = useState(() => crypto.randomUUID());
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const itemsTotal = useMemo(
    () => items.filter((i) => selectedKeys.has(i.key)).reduce((sum, i) => sum + i.lineTotal, 0),
    [items, selectedKeys],
  );
  const computedAmount = Math.min(refundable, itemsTotal + (includeShipping ? shippingTotal : 0));
  const amount = customAmount !== null ? Number(customAmount) || 0 : computedAmount;
  const amountValid = amount > 0 && amount <= refundable + 0.01;

  function reset() {
    setStep('items');
    setSelectedKeys(new Set());
    setIncludeShipping(false);
    setCustomAmount(null);
    setReason('');
    setResult(null);
  }

  function toggleItem(key: string) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function submit() {
    if (!amountValid || !reason.trim()) return;
    const token = refundToken;
    startTransition(async () => {
      const res = await refundOrder(orderId, amount, reason.trim(), token);
      setResult(res);
      setStep('done');
      setRefundToken(crypto.randomUUID());
      if (res.ok) onDone?.();
    });
  }

  const selectedTitles = items.filter((i) => selectedKeys.has(i.key)).map((i) => i.title);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="admin-btn admin-btn-danger"
      >
        ביצוע זיכוי
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        titleId="refund-dialog-title"
        title={`זיכוי (עד ${formatPrice(refundable, 'he', { alwaysAgorot: true })})`}
        variant="center"
        widthClassName="max-w-[32rem]"
      >
        <ol className="mb-5 flex items-center gap-2 text-caption text-muted" aria-hidden="true">
          {(['items', 'reason', 'confirm', 'done'] as const).map((s, i) => (
            <li
              key={s}
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                step === s ? 'bg-[var(--admin-accent)] text-white' : 'bg-cream-2'
              }`}
            >
              {i + 1}
            </li>
          ))}
        </ol>

        {step === 'items' ? (
          <div className="space-y-3">
            <p className="text-small font-semibold text-ink">אילו פריטים מזוכים?</p>
            <ul className="space-y-1.5">
              {items.map((item) => (
                <li key={item.key}>
                  <label className="flex items-center justify-between gap-3 rounded-[var(--admin-radius-btn)] px-2 py-1.5 text-small hover:bg-cream-2">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(item.key)}
                        onChange={() => toggleItem(item.key)}
                        className="h-4 w-4"
                      />
                      {item.title} <span className="text-caption text-muted">×{item.quantity}</span>
                    </span>
                    <span className="tabular-nums text-ink-soft">
                      {formatPrice(item.lineTotal, 'he', { alwaysAgorot: true })}
                    </span>
                  </label>
                </li>
              ))}
              {shippingTotal > 0 ? (
                <li>
                  <label className="flex items-center justify-between gap-3 rounded-[var(--admin-radius-btn)] px-2 py-1.5 text-small hover:bg-cream-2">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={includeShipping}
                        onChange={(e) => setIncludeShipping(e.target.checked)}
                        className="h-4 w-4"
                      />
                      דמי משלוח
                    </span>
                    <span className="tabular-nums text-ink-soft">
                      {formatPrice(shippingTotal, 'he', { alwaysAgorot: true })}
                    </span>
                  </label>
                </li>
              ) : null}
            </ul>

            <div className="border-t border-rule pt-3">
              <label className="flex items-center gap-2 text-caption text-muted">
                <input
                  type="checkbox"
                  checked={customAmount !== null}
                  onChange={(e) => setCustomAmount(e.target.checked ? String(computedAmount || '') : null)}
                  className="h-4 w-4"
                />
                סכום מותאם אישית (זיכוי חלקי/רצון טוב שלא תואם פריט מלא)
              </label>
              {customAmount !== null ? (
                <input
                  type="number"
                  dir="ltr"
                  min={0.01}
                  max={refundable}
                  step={0.01}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="admin-field-input mt-2"
                />
              ) : null}
            </div>

            <p className="text-small font-semibold text-ink">
              סה״כ לזיכוי: {formatPrice(amount, 'he', { alwaysAgorot: true })}
              {!amountValid && amount > 0 ? (
                <span className="ms-2 text-caption font-normal text-[var(--admin-danger)]">
                  חורג מהסכום הניתן לזיכוי
                </span>
              ) : null}
            </p>

            <button
              type="button"
              disabled={!amountValid}
              onClick={() => setStep('reason')}
              className="admin-btn admin-btn-solid w-full"
            >
              המשך
            </button>
          </div>
        ) : null}

        {step === 'reason' ? (
          <div className="space-y-3">
            <label htmlFor="refund-reason" className="admin-field-label">
              סיבת הזיכוי
            </label>
            <textarea
              id="refund-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="למשל: החזרת ספר, ביטול חלקי, פיצוי על איחור…"
              className="admin-field-input"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep('items')} className="admin-btn admin-btn-quiet">
                חזרה
              </button>
              <button
                type="button"
                disabled={!reason.trim()}
                onClick={() => setStep('confirm')}
                className="admin-btn admin-btn-solid flex-1"
              >
                המשך לסיכום
              </button>
            </div>
          </div>
        ) : null}

        {step === 'confirm' ? (
          <div className="space-y-3">
            <p className="admin-card px-4 py-3 text-small text-ink">
              אתם עומדים לזכות <span className="font-bold">{formatPrice(amount, 'he', { alwaysAgorot: true })}</span>
              {selectedTitles.length > 0 ? (
                <>
                  {' '}
                  עבור: {selectedTitles.join(', ')}
                  {includeShipping ? ' + דמי משלוח' : ''}
                </>
              ) : null}
              . הפעולה מתבצעת דרך מורנינג ובלתי הפיכה.
            </p>
            <p className="text-caption text-muted">סיבה: “{reason.trim()}”</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep('reason')} className="admin-btn admin-btn-quiet" disabled={pending}>
                חזרה
              </button>
              <button type="button" onClick={submit} disabled={pending} className="admin-btn admin-btn-danger flex-1">
                {pending ? 'מבצע זיכוי…' : 'אישור וביצוע זיכוי'}
              </button>
            </div>
          </div>
        ) : null}

        {step === 'done' && result ? (
          <div className="space-y-3">
            <p
              role="status"
              className={`rounded-[var(--radius-sm)] px-4 py-3 text-small ${
                result.ok
                  ? 'bg-[var(--admin-success-soft)] text-[var(--admin-success)]'
                  : 'bg-[var(--admin-danger-soft)] text-[var(--admin-danger)]'
              }`}
            >
              {result.ok ? '✓ הזיכוי בוצע.' : `⚠ ${result.error ?? 'הזיכוי נכשל'}`}
            </p>
            <button type="button" onClick={() => setOpen(false)} className="admin-btn admin-btn-quiet w-full">
              סגירה
            </button>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
