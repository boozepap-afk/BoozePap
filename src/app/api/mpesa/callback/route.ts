import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/server/supabase-admin';

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
    await db.from('orders').update({ payment_status: success ? 'paid' : Number(callback.ResultCode) === 1032 ? 'cancelled' : Number(callback.ResultCode) === 1037 ? 'timed_out' : 'failed', status: success ? 'paid' : 'pending_payment' }).eq('id', payment.order_id).eq('payment_status', 'pending_payment');
    if (success) await db.from('admin_notifications').insert({ order_id: payment.order_id, kind: 'payment_paid', title: 'M-Pesa payment received', body: `Payment for order ${callback.CheckoutRequestID} was confirmed by Safaricom.` });
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch { return NextResponse.json({ ResultCode: 1, ResultDesc: 'Callback processing failed' }, { status: 500 }); }
}
