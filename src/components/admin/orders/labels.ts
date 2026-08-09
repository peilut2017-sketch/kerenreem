/**
 * תוויות עברית לצירי המצב במסכי הניהול (הניהול עברי-קשיח, כמוסכמה).
 * שמות המצבים עצמם — באנגלית, כמו במסד; התווית לתצוגה בלבד.
 */

export const ORDER_STATE_LABELS: Record<string, string> = {
  draft: 'טיוטה',
  pending: 'ממתינה',
  confirmed: 'התקבלה',
  processing: 'בטיפול',
  cancel_pending_refund: 'ממתינה לזיכוי (ביטול)',
  completed: 'הושלמה',
  cancelled: 'בוטלה',
  closed: 'נסגרה',
};

export const PAYMENT_STATE_LABELS: Record<string, string> = {
  not_required: 'ללא תשלום',
  pending: 'ממתין',
  authorized: 'מאושר',
  paid: 'שולם',
  failed: 'נכשל',
  partially_refunded: 'זוכה חלקית',
  refunded: 'זוכה',
  cancelled: 'בוטל',
};

export const FULFILLMENT_STATE_LABELS: Record<string, string> = {
  unfulfilled: 'טרם טופל',
  preparing: 'בהכנה',
  ready_for_pickup: 'מוכן לאיסוף',
  partially_fulfilled: 'סופק חלקית',
  fulfilled: 'סופק',
  shipped: 'נשלח',
  delivered: 'נמסר',
  returned: 'הוחזר',
};

export const DOCUMENT_STATE_LABELS: Record<string, string> = {
  not_created: 'טרם הופק',
  pending: 'בהפקה',
  created: 'הופק',
  failed: 'נכשל',
  cancelled: 'בוטל',
  credited: 'זוכה',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  initiated: 'נפתח',
  pending: 'ממתין',
  succeeded: 'הצליח',
  failed: 'נכשל',
  cancelled: 'בוטל',
  expired: 'פג תוקף',
};

export const DOC_TYPE_LABELS: Record<string, string> = {
  invoice_receipt: 'חשבונית מס-קבלה',
  receipt: 'קבלה',
  donation_receipt: 'קבלה לתרומה',
  credit_note: 'זיכוי',
};

export const DOC_STATUS_LABELS: Record<string, string> = {
  pending: 'בהפקה',
  created: 'הופק',
  failed: 'נכשל',
  cancelled: 'בוטל',
};

export const NOTIFICATION_CHANNEL_LABELS: Record<string, string> = {
  email: 'מייל',
  sms: 'SMS',
  whatsapp: 'וואטסאפ',
};

export const NOTIFICATION_STATUS_LABELS: Record<string, string> = {
  queued: 'בתור',
  sent: 'נשלח',
  failed: 'נכשל',
  skipped: 'דולג',
};

export const EMAIL_TEMPLATE_LABELS: Record<string, string> = {
  order_confirmation: 'אישור הזמנה',
  order_updated: 'עדכון הזמנה',
  payment_received: 'התשלום התקבל',
  payment_failed: 'התשלום נכשל',
  document_ready: 'המסמך מוכן',
  shipped: 'נשלחה',
  ready_for_pickup: 'מוכנה לאיסוף',
  cancelled: 'בוטלה',
  refunded: 'בוצע זיכוי',
};

/** [1.4] תווית עברית לכל אחד מארבעת הצירים, לשורת "שינוי סטטוס" בציר הזמן. */
export function axisValueLabel(axis: string, value: string): string {
  if (axis === 'state') return ORDER_STATE_LABELS[value] ?? value;
  if (axis === 'payment_state') return PAYMENT_STATE_LABELS[value] ?? value;
  if (axis === 'fulfillment_state') return FULFILLMENT_STATE_LABELS[value] ?? value;
  if (axis === 'document_state') return DOCUMENT_STATE_LABELS[value] ?? value;
  return value;
}

export const AXIS_LABELS: Record<string, string> = {
  state: 'מצב הזמנה',
  payment_state: 'תשלום',
  fulfillment_state: 'אספקה',
  document_state: 'מסמך',
};

export function stateBadgeClass(value: string): string {
  if (['paid', 'confirmed', 'completed', 'delivered', 'fulfilled', 'created', 'succeeded'].includes(value)) {
    return 'admin-badge-success';
  }
  if (['failed', 'cancelled', 'returned', 'cancel_pending_refund', 'expired'].includes(value)) {
    return 'admin-badge-danger';
  }
  return 'admin-badge-neutral';
}
