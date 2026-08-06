import type {
  DocumentState,
  FulfillmentState,
  OrderState,
  PaymentState,
} from '@/lib/supabase/types';

/**
 * ארבע מכונות המצבים — טהורות, בלי תלות שרת, כדי שגם סקריפט הבדיקה
 * (check-commerce.mjs) יוכל לאמת אותן. orders.ts מייצא אותן הלאה.
 */

export const ORDER_STATE_TRANSITIONS: Record<OrderState, OrderState[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['completed', 'cancelled'],
  completed: ['closed'],
  cancelled: ['closed'],
  closed: [],
};

export const PAYMENT_STATE_TRANSITIONS: Record<PaymentState, PaymentState[]> = {
  not_required: [],
  pending: ['authorized', 'paid', 'failed', 'cancelled'],
  authorized: ['paid', 'failed', 'cancelled'],
  paid: ['partially_refunded', 'refunded'],
  failed: ['pending', 'cancelled'],
  partially_refunded: ['refunded'],
  refunded: [],
  cancelled: [],
};

export const FULFILLMENT_STATE_TRANSITIONS: Record<FulfillmentState, FulfillmentState[]> = {
  unfulfilled: ['preparing'],
  preparing: ['ready_for_pickup', 'shipped', 'partially_fulfilled', 'unfulfilled'],
  // partially_fulfilled קיים ב-enum אך חסום בממשק עד החלטה 13
  partially_fulfilled: ['shipped'],
  ready_for_pickup: ['fulfilled'],
  shipped: ['delivered', 'fulfilled'],
  delivered: ['returned'],
  fulfilled: ['returned'],
  returned: [],
};

export const DOCUMENT_STATE_TRANSITIONS: Record<DocumentState, DocumentState[]> = {
  not_created: ['pending', 'created'],
  pending: ['created', 'failed'],
  failed: ['pending', 'created'],
  created: ['credited', 'cancelled'],
  credited: [],
  cancelled: [],
};

export type StateAxis = 'state' | 'payment_state' | 'fulfillment_state' | 'document_state';

const TRANSITIONS: Record<StateAxis, Record<string, string[]>> = {
  state: ORDER_STATE_TRANSITIONS,
  payment_state: PAYMENT_STATE_TRANSITIONS,
  fulfillment_state: FULFILLMENT_STATE_TRANSITIONS,
  document_state: DOCUMENT_STATE_TRANSITIONS,
};

export function isTransitionAllowed(axis: StateAxis, from: string, to: string): boolean {
  if (from === to) return true;
  return (TRANSITIONS[axis][from] ?? []).includes(to);
}

/** מיפוי ארבעת הצירים לסטטוס בשפת לקוח (מפתח תרגום store.status*). */
export function customerStatusKey(order: {
  state: OrderState;
  payment_state: PaymentState;
  fulfillment_state: FulfillmentState;
}): string {
  if (order.state === 'cancelled') return 'statusCancelled';
  if (order.payment_state === 'refunded' || order.payment_state === 'partially_refunded')
    return 'statusRefunded';
  if (order.fulfillment_state === 'delivered' || order.fulfillment_state === 'fulfilled')
    return 'statusDelivered';
  if (order.fulfillment_state === 'shipped') return 'statusShipped';
  if (order.fulfillment_state === 'ready_for_pickup') return 'statusReadyForPickup';
  if (order.fulfillment_state === 'preparing') return 'statusPreparing';
  if (order.payment_state === 'paid') return 'statusReceived';
  if (order.payment_state === 'failed') return 'statusPaymentFailed';
  return 'statusPendingPayment';
}
