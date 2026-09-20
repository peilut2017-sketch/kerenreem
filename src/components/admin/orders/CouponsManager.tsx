'use client';

import { useState, useTransition } from 'react';
import { Drawer } from '@/components/Drawer';
import { deleteCoupon, saveCoupon, setCouponActive } from '@/lib/admin/coupons-actions';
import { AdminIcon } from '@/components/admin/AdminIcons';
import type { PromotionOption } from './PromotionsManager';

import { formatAdminDate } from '@/lib/admin/reporting/format';
export interface AdminCoupon {
  id: string;
  code: string;
  kind: 'percent' | 'fixed' | 'free_shipping';
  value: number;
  minTotal: number | null;
  endsAt: string | null;
  maxUses: number | null;
  maxUsesPerCustomer: number;
  active: boolean;
  uses: number;
  minQuantity: number | null;
  restrictedContact: string | null;
  combinableWithSale: boolean;
  combinableWithCoupons: boolean;
  categoryIds: string[];
  bookIds: string[];
  excludeBookIds: string[];
}

const KIND_LABELS: Record<AdminCoupon['kind'], string> = {
  percent: 'אחוז הנחה',
  fixed: 'סכום קבוע',
  free_shipping: 'משלוח חינם',
};

const dateFmt = (value: string | number | Date) => formatAdminDate(value, 'date');

type Step = 'details' | 'scope' | 'limits' | 'preview';
const STEPS: Step[] = ['details', 'scope', 'limits', 'preview'];

/**
 * [1.6] מגירת אשף בת ארבעה צעדים (ביקורת י.9), במקום טופס שטוח
 * תמיד-פתוח שנפתח מעל הטבלה: פרטי הקופון → תחולה → הגבלות → תצוגה
 * מקדימה ואישור. הלוגיקה עצמה (upsert יחיד ב-saveCoupon עם כל השדות
 * תמיד, תחולה, תצוגה מקדימה) כבר הייתה נכונה — זהו רק שינוי מבני
 * למגירה, באותה תבנית כמו RefundDialog/CardPaymentDrawer.
 */
export function CouponsManager({
  coupons,
  categories,
  books,
}: {
  coupons: AdminCoupon[];
  categories: PromotionOption[];
  books: PromotionOption[];
}) {
  const empty = {
    id: null as string | null,
    code: '',
    kind: 'percent' as AdminCoupon['kind'],
    value: '',
    minTotal: '',
    minQuantity: '',
    maxUses: '',
    maxUsesPerCustomer: '1',
    endsAt: '',
    restrictedContact: '',
    combinableWithSale: false,
    combinableWithCoupons: false,
    categoryIds: [] as string[],
    bookIds: [] as string[],
    excludeBookIds: [] as string[],
  };
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('details');
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function openNew() {
    setForm(empty);
    setStep('details');
    setFormError(null);
    setOpen(true);
    setMessage(null);
  }

  function edit(coupon: AdminCoupon) {
    setForm({
      id: coupon.id,
      code: coupon.code,
      kind: coupon.kind,
      value: coupon.kind === 'free_shipping' ? '' : String(coupon.value),
      minTotal: coupon.minTotal != null ? String(coupon.minTotal) : '',
      minQuantity: coupon.minQuantity != null ? String(coupon.minQuantity) : '',
      maxUses: coupon.maxUses != null ? String(coupon.maxUses) : '',
      maxUsesPerCustomer: String(coupon.maxUsesPerCustomer || 1),
      endsAt: coupon.endsAt ? coupon.endsAt.slice(0, 10) : '',
      restrictedContact: coupon.restrictedContact ?? '',
      combinableWithSale: coupon.combinableWithSale,
      combinableWithCoupons: coupon.combinableWithCoupons,
      categoryIds: coupon.categoryIds,
      bookIds: coupon.bookIds,
      excludeBookIds: coupon.excludeBookIds,
    });
    setStep('details');
    setFormError(null);
    setOpen(true);
    setMessage(null);
  }

  function submit() {
    setFormError(null);
    startTransition(async () => {
      const result = await saveCoupon(form.id, {
        code: form.code,
        kind: form.kind,
        value: form.kind === 'free_shipping' ? 0 : Number(form.value),
        minTotal: form.minTotal.trim() === '' ? null : Number(form.minTotal),
        minQuantity: form.minQuantity.trim() === '' ? null : Number(form.minQuantity),
        maxUses: form.maxUses.trim() === '' ? null : Number(form.maxUses),
        maxUsesPerCustomer: Number(form.maxUsesPerCustomer) || 1,
        endsAt: form.endsAt ? new Date(`${form.endsAt}T23:59:59`).toISOString() : null,
        restrictedContact: form.restrictedContact.trim().toLowerCase() || null,
        combinableWithSale: form.combinableWithSale,
        combinableWithCoupons: form.combinableWithCoupons,
        categoryIds: form.categoryIds,
        bookIds: form.bookIds,
        excludeBookIds: form.excludeBookIds,
      });
      if (result.ok) {
        setForm(empty);
        setOpen(false);
        setMessage('נשמר.');
      } else {
        setFormError(result.error ?? 'השמירה נכשלה');
      }
    });
  }

  const multiSelect = (
    label: string,
    options: PromotionOption[],
    selected: string[],
    onChange: (next: string[]) => void,
  ) => (
    <div>
      <span className="admin-field-label">{label}</span>
      <select
        multiple
        size={Math.min(5, Math.max(3, options.length))}
        value={selected}
        onChange={(e) => onChange([...e.target.selectedOptions].map((o) => o.value))}
        className="admin-field-input h-auto"
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  const valueLabel = form.kind === 'percent' ? `${form.value || 0}%` : `${form.value || 0} ₪`;
  const scopeLabel =
    form.categoryIds.length === 0 && form.bookIds.length === 0
      ? 'כל האתר'
      : [
          form.categoryIds.length ? `${form.categoryIds.length} קטגוריות` : null,
          form.bookIds.length ? `${form.bookIds.length} ספרים` : null,
        ]
          .filter(Boolean)
          .join(' + ');
  const preview =
    form.code.trim() && (form.kind === 'free_shipping' || Number(form.value) > 0)
      ? `${form.code.trim().toUpperCase()} · ${form.kind === 'free_shipping' ? 'משלוח חינם' : `${valueLabel} הנחה`} · ${scopeLabel}${form.endsAt ? ` · עד ${dateFmt(new Date(form.endsAt))}` : ''}`
      : null;

  const detailsValid = Boolean(form.code.trim()) && (form.kind === 'free_shipping' || Number(form.value) > 0);
  const stepIndex = STEPS.indexOf(step);

  return (
    <section aria-labelledby="coupons-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="coupons-heading" className="flex items-center gap-2 font-serif text-h3 text-ink">
          <span className="admin-icon-chip h-9 w-9">
            <AdminIcon name="coupon" className="h-4.5 w-4.5" />
          </span>
          קופונים
        </h2>
        <button type="button" onClick={openNew} className="admin-btn admin-btn-solid">
          <AdminIcon name="plus" className="h-4 w-4" />
          קופון חדש
        </button>
      </div>

      {message ? (
        <p role="status" className="mb-3 text-caption text-ink-soft">
          {message}
        </p>
      ) : null}

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        titleId="coupon-wizard-title"
        title={form.id ? `עריכת קופון · ${form.code || '—'}` : 'קופון חדש'}
        variant="center"
        widthClassName="max-w-[38rem]"
      >
        <ol className="mb-5 flex items-center gap-2 text-caption text-muted" aria-hidden="true">
          {STEPS.map((s, i) => (
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

        {step === 'details' ? (
          <div className="space-y-4">
            <p className="text-small font-semibold text-ink">פרטי הקופון</p>
            <div>
              <label htmlFor="coupon-code" className="admin-field-label">
                קוד
              </label>
              <input
                id="coupon-code"
                dir="ltr"
                value={form.code}
                onChange={(e) => setForm((v) => ({ ...v, code: e.target.value }))}
                placeholder="ELUL-25"
                className="admin-field-input"
              />
            </div>
            <div>
              <label htmlFor="coupon-kind" className="admin-field-label">
                סוג
              </label>
              <select
                id="coupon-kind"
                value={form.kind}
                onChange={(e) => setForm((v) => ({ ...v, kind: e.target.value as AdminCoupon['kind'] }))}
                className="admin-field-input"
              >
                <option value="percent">אחוז הנחה</option>
                <option value="fixed">סכום קבוע (₪)</option>
                <option value="free_shipping">משלוח חינם</option>
              </select>
            </div>
            {form.kind !== 'free_shipping' ? (
              <div>
                <label htmlFor="coupon-value" className="admin-field-label">
                  ערך
                </label>
                <input
                  id="coupon-value"
                  type="number"
                  dir="ltr"
                  min={0}
                  step={0.5}
                  value={form.value}
                  onChange={(e) => setForm((v) => ({ ...v, value: e.target.value }))}
                  className="admin-field-input"
                />
              </div>
            ) : null}
            <button
              type="button"
              disabled={!detailsValid}
              onClick={() => setStep('scope')}
              className="admin-btn admin-btn-solid w-full"
            >
              המשך לתחולה
            </button>
          </div>
        ) : null}

        {step === 'scope' ? (
          <div className="space-y-4">
            <p className="text-small font-semibold text-ink">על מה חל הקופון?</p>
            {multiSelect('קטגוריות (ריק = כל האתר)', categories, form.categoryIds, (next) =>
              setForm((v) => ({ ...v, categoryIds: next })),
            )}
            {multiSelect('ספרים (ריק = כל האתר)', books, form.bookIds, (next) =>
              setForm((v) => ({ ...v, bookIds: next })),
            )}
            {multiSelect('החרגת ספרים', books, form.excludeBookIds, (next) =>
              setForm((v) => ({ ...v, excludeBookIds: next })),
            )}
            <label className="flex items-center gap-2 text-small text-ink-soft">
              <input
                type="checkbox"
                checked={form.combinableWithSale}
                onChange={(e) => setForm((v) => ({ ...v, combinableWithSale: e.target.checked }))}
                className="h-4 w-4"
              />
              חל גם על ספרים במבצע
            </label>
            <label className="flex items-center gap-2 text-small text-ink-soft">
              <input
                type="checkbox"
                checked={form.combinableWithCoupons}
                onChange={(e) => setForm((v) => ({ ...v, combinableWithCoupons: e.target.checked }))}
                className="h-4 w-4"
              />
              ניתן לצירוף עם קופונים נוספים
              <span className="text-caption text-muted">(ברירת מחדל: לא — קופון אחד להזמנה)</span>
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep('details')} className="admin-btn admin-btn-quiet">
                חזרה
              </button>
              <button type="button" onClick={() => setStep('limits')} className="admin-btn admin-btn-solid flex-1">
                המשך להגבלות
              </button>
            </div>
          </div>
        ) : null}

        {step === 'limits' ? (
          <div className="space-y-4">
            <p className="text-small font-semibold text-ink">הגבלות שימוש</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="coupon-min" className="admin-field-label">
                  סכום מינימום (₪)
                </label>
                <input
                  id="coupon-min"
                  type="number"
                  dir="ltr"
                  min={0}
                  value={form.minTotal}
                  onChange={(e) => setForm((v) => ({ ...v, minTotal: e.target.value }))}
                  className="admin-field-input"
                />
              </div>
              <div>
                <label htmlFor="coupon-minqty" className="admin-field-label">
                  מינימום יחידות (קנה X)
                </label>
                <input
                  id="coupon-minqty"
                  type="number"
                  dir="ltr"
                  min={1}
                  value={form.minQuantity}
                  onChange={(e) => setForm((v) => ({ ...v, minQuantity: e.target.value }))}
                  placeholder="ללא"
                  className="admin-field-input"
                />
              </div>
              <div>
                <label htmlFor="coupon-ends" className="admin-field-label">
                  תוקף עד
                </label>
                <input
                  id="coupon-ends"
                  type="date"
                  dir="ltr"
                  value={form.endsAt}
                  onChange={(e) => setForm((v) => ({ ...v, endsAt: e.target.value }))}
                  className="admin-field-input"
                />
              </div>
              <div>
                <label htmlFor="coupon-max" className="admin-field-label">
                  מקסימום שימושים (כלל הקופון)
                </label>
                <input
                  id="coupon-max"
                  type="number"
                  dir="ltr"
                  min={1}
                  value={form.maxUses}
                  onChange={(e) => setForm((v) => ({ ...v, maxUses: e.target.value }))}
                  placeholder="ללא הגבלה"
                  className="admin-field-input"
                />
              </div>
              <div>
                <label htmlFor="coupon-per" className="admin-field-label">
                  שימושים ללקוח
                </label>
                <input
                  id="coupon-per"
                  type="number"
                  dir="ltr"
                  min={1}
                  value={form.maxUsesPerCustomer}
                  onChange={(e) => setForm((v) => ({ ...v, maxUsesPerCustomer: e.target.value }))}
                  className="admin-field-input"
                />
              </div>
              <div>
                <label htmlFor="coupon-contact" className="admin-field-label">
                  קופון אישי (טלפון/מייל)
                </label>
                <input
                  id="coupon-contact"
                  dir="ltr"
                  value={form.restrictedContact}
                  onChange={(e) => setForm((v) => ({ ...v, restrictedContact: e.target.value }))}
                  placeholder="לכולם"
                  className="admin-field-input"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep('scope')} className="admin-btn admin-btn-quiet">
                חזרה
              </button>
              <button type="button" onClick={() => setStep('preview')} className="admin-btn admin-btn-solid flex-1">
                המשך לתצוגה מקדימה
              </button>
            </div>
          </div>
        ) : null}

        {step === 'preview' ? (
          <div className="space-y-4">
            <p className="text-small font-semibold text-ink">תצוגה מקדימה ואישור</p>
            {preview ? (
              <p className="admin-card px-4 py-3 text-small text-ink" dir="ltr">
                <span dir="rtl" className="me-1 text-caption text-muted">
                  כך יופיע הקופון:
                </span>
                {preview}
              </p>
            ) : (
              <p className="text-small text-muted">חסרים פרטים לתצוגה מקדימה — חזרו לצעד הראשון.</p>
            )}
            <ul className="space-y-1 text-caption text-ink-soft">
              <li>הגבלת שימוש: {form.maxUses ? `${form.maxUses} בסך הכול, ` : 'ללא הגבלה כוללת, '}{form.maxUsesPerCustomer || 1} ללקוח</li>
              {form.restrictedContact ? <li>מוגבל ל: {form.restrictedContact}</li> : null}
              <li>צירוף עם מבצע: {form.combinableWithSale ? 'כן' : 'לא'} · צירוף עם קופון נוסף: {form.combinableWithCoupons ? 'כן' : 'לא'}</li>
            </ul>
            {formError ? (
              <p role="alert" className="rounded-[var(--radius-sm)] bg-[var(--admin-danger-soft)] px-3 py-2 text-caption text-[var(--admin-danger)]">
                ⚠ {formError}
              </p>
            ) : null}
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep('limits')} className="admin-btn admin-btn-quiet" disabled={pending}>
                חזרה
              </button>
              <button
                type="button"
                disabled={pending || !detailsValid}
                onClick={submit}
                className="admin-btn admin-btn-solid flex-1"
              >
                {pending ? 'שומר…' : form.id ? 'שמירת השינויים' : 'יצירת הקופון'}
              </button>
            </div>
          </div>
        ) : null}

        {stepIndex > 0 ? (
          <p className="mt-5 text-center text-caption text-muted">צעד {stepIndex + 1} מתוך {STEPS.length}</p>
        ) : null}
      </Drawer>

      <div className="admin-card admin-table-wrap">
        <table className="admin-table w-full min-w-[36rem] text-small">
          <thead>
            <tr className="border-b border-rule text-caption text-muted">
              <th scope="col" className="px-4 py-3 text-start">קוד</th>
              <th scope="col" className="px-4 py-3 text-start">סוג</th>
              <th scope="col" className="px-4 py-3 text-start">ערך</th>
              <th scope="col" className="px-4 py-3 text-start">תחולה</th>
              <th scope="col" className="px-4 py-3 text-start">תוקף עד</th>
              <th scope="col" className="px-4 py-3 text-start">שימושים</th>
              <th scope="col" className="px-4 py-3 text-start">מצב</th>
              <th scope="col" className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted">
                  אין קופונים עדיין.
                </td>
              </tr>
            ) : (
              coupons.map((coupon) => (
                <tr key={coupon.id} className="border-b border-rule/60">
                  <td dir="ltr" className="px-4 py-2.5 font-semibold">{coupon.code}</td>
                  <td className="px-4 py-2.5">{KIND_LABELS[coupon.kind]}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {coupon.kind === 'percent'
                      ? `${coupon.value}%`
                      : coupon.kind === 'fixed'
                        ? `${coupon.value} ₪`
                        : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-muted">
                    {coupon.categoryIds.length === 0 && coupon.bookIds.length === 0
                      ? 'כל האתר'
                      : [
                          coupon.categoryIds.length ? `${coupon.categoryIds.length} קטגוריות` : null,
                          coupon.bookIds.length ? `${coupon.bookIds.length} ספרים` : null,
                        ]
                          .filter(Boolean)
                          .join(' + ')}
                  </td>
                  <td dir="ltr" className="px-4 py-2.5 text-muted">
                    {coupon.endsAt ? dateFmt(new Date(coupon.endsAt)) : '—'}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {coupon.uses}
                    {coupon.maxUses != null ? ` / ${coupon.maxUses}` : ''}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(() => setCouponActive(coupon.id, !coupon.active))
                      }
                      className={`admin-badge ${coupon.active ? 'admin-badge-success' : 'admin-badge-neutral'} admin-badge-button`}
                    >
                      {coupon.active ? 'פעיל' : 'כבוי'}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-end">
                    <span className="inline-flex gap-1">
                      <button
                        type="button"
                        aria-label={`עריכה — ${coupon.code}`}
                        onClick={() => edit(coupon)}
                        className="admin-btn admin-btn-ghost admin-btn-icon"
                      >
                        <AdminIcon name="edit" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`מחיקה — ${coupon.code}`}
                        onClick={() => {
                          if (!window.confirm(`למחוק את הקופון ${coupon.code}? פעולה בלתי הפיכה.`)) return;
                          startTransition(async () => {
                            const result = await deleteCoupon(coupon.id);
                            setMessage(result.error ?? (result.ok ? 'נמחק.' : 'המחיקה נכשלה'));
                          });
                        }}
                        className="admin-btn admin-btn-ghost admin-btn-icon"
                      >
                        <AdminIcon name="trash" className="h-4 w-4" />
                      </button>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
