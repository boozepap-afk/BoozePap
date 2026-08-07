import type { SupabaseClient } from '@supabase/supabase-js';
import { deliverEmail } from '@/lib/server/resend-email';

const SITE_URL = 'https://boozepap.com';
const MAX_ATTEMPTS = 3;

export type OrderEmailEvent = 'placed' | 'accepted' | 'preparing' | 'dispatched' | 'delivered' | 'cancelled' | 'new_order_admin';
export type EmailOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  deliveryAddress: string;
  paymentMethod: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  estimatedDelivery: string;
  items: Array<{ name: string; quantity: number; unitPrice: number; lineTotal: number }>;
  riderName?: string | null;
  riderPhone?: string | null;
};

const eventCopy: Record<OrderEmailEvent, { subject: (number: string) => string; heading: string; message: string }> = {
  placed: { subject: number => `Order ${number} received`, heading: 'Thanks for your order', message: 'We received your order and will update you as it moves through delivery.' },
  accepted: { subject: number => `Order ${number} accepted`, heading: 'Your order is accepted', message: 'The BoozePap team has accepted your order.' },
  preparing: { subject: number => `Order ${number} is being prepared`, heading: 'We are preparing your order', message: 'Your items are being packed and checked for dispatch.' },
  dispatched: { subject: number => `Order ${number} is on the way`, heading: 'Your rider is on the way', message: 'Your order has left BoozePap and is heading to you.' },
  delivered: { subject: number => `Order ${number} delivered`, heading: 'Your order was delivered', message: 'Thank you for choosing BoozePap. We hope you enjoy your order responsibly.' },
  cancelled: { subject: number => `Order ${number} cancelled`, heading: 'Your order was cancelled', message: 'Your order has been cancelled. Contact BoozePap customer care if you need help.' },
  new_order_admin: { subject: number => `New BoozePap order ${number}`, heading: 'New order placed', message: 'A new customer order needs attention.' },
};

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);
const money = (value: number) => `KES ${Number(value).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function orderEmailHtml(order: EmailOrder, event: OrderEmailEvent) {
  const copy = eventCopy[event];
  const rows = order.items.map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.quantity)}</td><td>${escapeHtml(money(item.lineTotal))}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><body style="font-family:Arial,sans-serif;color:#111827;background:#fff7f2;padding:24px"><main style="max-width:640px;margin:auto;background:#fff;padding:24px"><h1 style="color:#082b57">${escapeHtml(copy.heading)}</h1><p>${escapeHtml(copy.message)}</p><p><strong>Order:</strong> ${escapeHtml(order.orderNumber)}</p><p><strong>Customer:</strong> ${escapeHtml(order.customerName)}</p><table style="width:100%;border-collapse:collapse"><thead><tr><th align="left">Item</th><th align="left">Qty</th><th align="left">Total</th></tr></thead><tbody>${rows}</tbody></table><p><strong>Subtotal:</strong> ${escapeHtml(money(order.subtotal))}</p><p><strong>Delivery:</strong> ${escapeHtml(money(order.deliveryFee))}</p><p><strong>Order total:</strong> ${escapeHtml(money(order.total))}</p><p><strong>Delivery address:</strong> ${escapeHtml(order.deliveryAddress)}</p><p><strong>Payment:</strong> ${escapeHtml(order.paymentMethod)}</p><p><strong>Estimated delivery:</strong> ${escapeHtml(order.estimatedDelivery)}</p><small>Customers must be 18 or older. Please drink responsibly.</small></main></body></html>`;
}

export async function sendOrderEmail(db: SupabaseClient, order: EmailOrder, event: OrderEmailEvent, recipient: string) {
  if (!recipient) return { status: 'skipped' as const, reason: 'No recipient' };
  const eventKey = `order_${event}`;
  const { data: existing } = await db.from('notification_deliveries').select('id,status,attempts').eq('order_id', order.id).eq('channel', 'email').eq('recipient', recipient).eq('event_key', eventKey).maybeSingle();
  if (existing?.status === 'sent' || existing?.status === 'pending') {
    console.info('[Order email] duplicate skipped', { orderId: order.id, event, recipient, status: existing.status });
    return { status: 'skipped' as const, reason: `Already ${existing.status}` };
  }
  if (existing && Number(existing.attempts) >= MAX_ATTEMPTS) return { status: 'skipped' as const, reason: 'Retry limit reached' };
  let deliveryId = existing?.id as string | undefined;
  if (deliveryId) await db.from('notification_deliveries').update({ status: 'pending', error_message: null }).eq('id', deliveryId);
  else {
    const { data: claimed, error } = await db.from('notification_deliveries').insert({ order_id: order.id, channel: 'email', recipient, event_key: eventKey, status: 'pending', attempts: 0 }).select('id').single();
    if (error || !claimed) {
      console.info('[Order email] duplicate claim skipped', { orderId: order.id, event, recipient });
      return { status: 'skipped' as const, reason: 'Another request claimed this email' };
    }
    deliveryId = claimed.id;
  }
  const copy = eventCopy[event];
  const result = await deliverEmail(recipient, copy.subject(order.orderNumber), orderEmailHtml(order, event));
  const attempts = Number(existing?.attempts || 0) + result.attempts;
  await db.from('notification_deliveries').update({ status: result.status, attempts, provider_message_id: result.reference || null, error_message: result.error || null, sent_at: result.status === 'sent' ? new Date().toISOString() : null }).eq('id', deliveryId);
  const details = { orderId: order.id, event, recipient, status: result.status, attempts, providerReference: result.reference || null, error: result.error || null };
  if (result.status === 'sent') console.info('[Order email] delivered', details); else console.error('[Order email] failed', details);
  return result;
}
