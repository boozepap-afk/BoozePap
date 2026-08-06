type MpesaConfig = { key: string; secret: string; shortcode: string; passkey: string; callback: string; environment: string };

function config(): MpesaConfig {
  const key = process.env.MPESA_CONSUMER_KEY, secret = process.env.MPESA_CONSUMER_SECRET, shortcode = process.env.MPESA_SHORTCODE, passkey = process.env.MPESA_PASSKEY, callback = process.env.MPESA_CALLBACK_URL;
  if (!key || !secret || !shortcode || !passkey || !callback) throw new Error('M-Pesa is not configured. Set the required Daraja server environment variables.');
  return { key, secret, shortcode, passkey, callback, environment: process.env.MPESA_ENVIRONMENT || 'sandbox' };
}
export function kenyaPhone(value: string) { const digits = value.replace(/\D/g, ''); const local = digits.startsWith('0') ? digits.slice(1) : digits.startsWith('254') ? digits.slice(3) : digits; if (!/^7\d{8}$/.test(local)) throw new Error('Enter a valid Kenyan M-Pesa number, for example 0712345678.'); return `254${local}`; }
export async function requestStkPush({ amount, phone, accountReference, description }: { amount: number; phone: string; accountReference: string; description: string }) {
  const c = config(), root = c.environment === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
  const tokenResponse = await fetch(`${root}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${Buffer.from(`${c.key}:${c.secret}`).toString('base64')}` }, cache: 'no-store' });
  if (!tokenResponse.ok) throw new Error('M-Pesa authentication failed. Please try again later.');
  const accessToken = (await tokenResponse.json()).access_token as string, timestamp = new Date().toISOString().replaceAll('-', '').replaceAll(':', '').replace('T', '').replace('Z', '').replace('.', '').slice(0, 14);
  const password = Buffer.from(`${c.shortcode}${c.passkey}${timestamp}`).toString('base64');
  const response = await fetch(`${root}/mpesa/stkpush/v1/processrequest`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ BusinessShortCode: c.shortcode, Password: password, Timestamp: timestamp, TransactionType: 'CustomerPayBillOnline', Amount: Math.round(amount), PartyA: phone, PartyB: c.shortcode, PhoneNumber: phone, CallBackURL: c.callback, AccountReference: accountReference.slice(0, 12), TransactionDesc: description.slice(0, 13) }) });
  const result = await response.json();
  if (!response.ok || result.ResponseCode !== '0') throw new Error(result.errorMessage || result.ResponseDescription || 'M-Pesa could not start the payment.');
  return { merchantRequestId: result.MerchantRequestID as string, checkoutRequestId: result.CheckoutRequestID as string };
}
