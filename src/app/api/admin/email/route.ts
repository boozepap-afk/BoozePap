import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/server/supabase-admin';
import { getEmailConfig, safeEmailStatus } from '@/lib/server/email-config';
import { deliverEmail } from '@/lib/server/resend-email';

async function isAdministrator(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const db = getAdminSupabase();
  const { data } = await db.auth.getUser(token);
  if (!data.user) return false;
  const { data: admin } = await db.from('admin_users').select('user_id').eq('user_id', data.user.id).eq('is_active', true).maybeSingle();
  return Boolean(admin);
}

export async function GET(request: NextRequest) {
  if (!await isAdministrator(request)) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  return NextResponse.json(safeEmailStatus());
}

export async function POST(request: NextRequest) {
  if (!await isAdministrator(request)) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  const config = getEmailConfig();
  if (!config.configured) return NextResponse.json({ ...safeEmailStatus(), status: 'not_configured', error: `Missing: ${config.missing.join(', ') || 'EMAIL_PROVIDER=resend'}` }, { status: 503 });
  if (!config.adminEmail) return NextResponse.json({ ...safeEmailStatus(), status: 'not_configured', error: 'Missing: ADMIN_ORDER_EMAIL' }, { status: 503 });
  const result = await deliverEmail(config.adminEmail, 'BoozePap Email Test Successful', '<div style="font-family:Arial,sans-serif;padding:24px"><h1 style="color:#ff4b18">BoozePap Email Test Successful</h1><p>Your Resend order-email integration is working correctly.</p></div>');
  if (result.status !== 'sent') { console.error('[Admin email test] failed', { status: result.status, error: result.error }); return NextResponse.json({ ...safeEmailStatus(), status: result.status === 'not_configured' ? 'not_configured' : 'send_failed', error: result.error }, { status: 502 }); }
  console.info('[Admin email test] sent', { provider: 'resend', messageId: result.reference });
  return NextResponse.json({ status: 'sent', configured: true, provider: 'resend', messageId: result.reference });
}
