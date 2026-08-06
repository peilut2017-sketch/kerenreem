/**
 * תוויות עברית לצירי המצב במסכי הניהול (הניהול עברי-קשיח, כמוסכמה).
 * שמות המצבים עצמם — באנגלית, כמו במסד; התווית לתצוגה בלבד.
 */

export const ORDER_STATE_LABELS: Record<string, string> = {
  draft: 'טיוטה',
  pending: 'ממתינה',
  confirmed: 'התקבלה',
  processing: 'בטיפול',
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

export function stateBadgeClass(value: string): string {
  if (['paid', 'confirmed', 'completed', 'delivered', 'fulfilled', 'created'].includes(value)) {
    return 'admin-badge-success';
  }
  if (['failed', 'cancelled', 'returned'].includes(value)) return 'admin-badge-warning';
  return 'admin-badge-neutral';
}
