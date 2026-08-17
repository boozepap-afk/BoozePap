export const ORDER_STATUSES = ['pending','awaiting_payment','paid','confirmed','preparing','ready_for_dispatch','dispatched','delivered','cancelled'] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];
export const UNREVIEWED_ORDER_STATUSES: readonly OrderStatus[] = ['pending','awaiting_payment','paid'];
export const isOrderStatus = (value: unknown): value is OrderStatus => ORDER_STATUSES.includes(value as OrderStatus);

/** Customer-facing fulfilment is intentionally three steps:
 * Confirmed → Dispatched → Delivered.
 * Legacy preparing/ready_for_dispatch orders can still advance to dispatched. */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['confirmed','cancelled'],
  awaiting_payment: ['paid','cancelled'],
  paid: ['confirmed','cancelled'],
  confirmed: ['dispatched','cancelled'],
  preparing: ['dispatched','cancelled'],
  ready_for_dispatch: ['dispatched','cancelled'],
  dispatched: ['delivered','cancelled'],
  delivered: [],
  cancelled: [],
};

export const orderStatusLabel = (status: OrderStatus) => status.split('_').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
