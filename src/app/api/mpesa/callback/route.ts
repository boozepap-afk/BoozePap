import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/server/supabase-admin';
import { sendOrderEmail, type EmailOrder } from '@/lib/server/order-email';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json(); const callback = payload?.Body?.stkCallback;
    if (!callback?.CheckoutRequestID) return NextResponse.json({ ResultCode: 1, ResultDesc: 'Invalid callback' }, { status: 400 });
    const db = getAdminSupabase(); const { data: payment } = await db.from('payments').select('id,order_id,status,amount').eq('checkout_request_id', callback.CheckoutRequestID).maybeSingle();
    // Return a successful acknowledgement for duplicate or unknown callbacks so
    // Daraja does not repeatedly deliver the same request.
    if (!payment || payment.status === 'paid') return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    const metadata = Object.fromEntries((callback.CallbackMetadata?.Item || []).map((item: { Name: string; Value?: unknown }) => [item.Name, item.Value])); const success = Number(callback.ResultCode) === 0 && Number(metadata.Amount) === Number(payment.amount);
    await db.from('payments').update({ status: success ? 'paid' : Number(callback.ResultCode) === 1032 ? 'cancelled' : Number(callback.ResultCode) === 1037 ? 'timed_out' : 'failed', receipt_number: String(metadata.MpesaReceiptNumber || '') || null, transaction_at: metadata.TransactionDate ? new Date(String(metadata.TransactionDate)).toISOString() : null, provider_result_code: String(callback.ResultCode), provider_result_desc: callback.ResultDesc, raw_callback: payload }).eq('id', payment.id);
    await db.from('orders').update({ payment_status: success ? 'paid' : Number(callback.ResultCode) === 1032 ? 'cancelled' : Number(callback.ResultCode) === 1037 ? 'timed_out' : 'failed', status: success ? 'paid' : 'awaiting_payment' }).eq('id', payment.order_id).eq('payment_status', 'pending_payment');
    if (success) {
      await db.from('admin_notifications').insert({ order_id: payment.order_id, kind: 'payment_paid', title: 'M-Pesa payment received', body: `Payment for order ${callback.CheckoutRequestID} was confirmed by Safaricom.` });
      const { data: order, error: orderError } = await db.from('orders').select('id,order_number,customer_name,customer_email,customer_phone,delivery_address,payment_method,subtotal,delivery_fee,total,order_items(product_name,quantity,unit_price,line_total)').eq('id', payment.order_id).maybeSingle();
      if (orderError || !order) console.error('[M-Pesa callback] confirmed order email lookup failed', orderError);
      else {
        const emailOrder: EmailOrder = { id: order.id, orderNumber: order.order_number, customerName: order.customer_name || 'Customer', customerEmail: order.customer_email, customerPhone: order.customer_phone || '', deliveryAddress: order.delivery_address || '', paymentMethod: order.payment_method || 'mpesa', subtotal: Number(order.subtotal || 0), deliveryFee: Number(order.delivery_fee || 0), total: Number(order.total || 0), estimatedDelivery: 'Your order is confirmed and is being prepared', items: (order.order_items || []).map(item => ({ name: item.product_name, quantity: Number(item.quantity), unitPrice: Number(item.unit_price), lineTotal: Number(item.line_total) })) };
        const emailTasks: Array<Promise<unknown>> = [];
        if (emailOrder.customerEmail) emailTasks.push(sendOrderEmail(db, emailOrder, 'placed', emailOrder.customerEmail));
        if (process.env.ADMIN_ORDER_EMAIL) emailTasks.push(sendOrderEmail(db, emailOrder, 'new_order_admin', process.env.ADMIN_ORDER_EMAIL));
        const emailResults = await Promise.allSettled(emailTasks);
        emailResults.forEach(result => { if (result.status === 'rejected') console.error('[M-Pesa callback] confirmed order email failed', result.reason); });
      }
    }
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch { return NextResponse.json({ ResultCode: 1, ResultDesc: 'Callback processing failed' }, { status: 500 }); }
}
