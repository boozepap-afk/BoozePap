import 'server-only';
import { getEmailConfig } from '@/lib/server/email-config';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const MAX_ATTEMPTS = 3;
type DeliveryResult = { status: 'sent' | 'failed' | 'not_configured'; attempts: number; reference?: string; error?: string };

async function sendGmail(recipient: string, subject: string, html: string): Promise<DeliveryResult> {
  const config = getEmailConfig();
  if (!config.gmailUser || !config.gmailAppPassword) return { status: 'not_configured', attempts: 0, error: `Email provider not configured. Missing: ${config.missing.join(', ')}` };
  // Kept as a runtime import so this server-only transport never enters a
  // client bundle. nodemailer is installed as a production dependency.
  const nodemailer = await (Function('return import("nodemailer")')() as Promise<{ createTransport: (options: unknown) => { sendMail: (message: unknown) => Promise<{ messageId?: string }>; close: () => void } }>);
  const transport = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: config.gmailUser, pass: config.gmailAppPassword } });
  try {
    const sent = await transport.sendMail({ from: config.from || `BoozePap <${config.gmailUser}>`, to: recipient, subject, html });
    return { status: 'sent', attempts: 1, reference: sent.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gmail SMTP delivery failed';
    console.error('[Email transport] Gmail SMTP failed', { message });
    return { status: 'failed', attempts: 1, error: message };
  } finally { transport.close(); }
}

async function sendResend(recipient: string, subject: string, html: string): Promise<DeliveryResult> {
  const config = getEmailConfig();
  if (!config.resendApiKey || !config.from) return { status: 'not_configured', attempts: 0, error: `Email provider not configured. Missing: ${config.missing.join(', ')}` };
  let lastError = 'Email delivery failed';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(RESEND_ENDPOINT, { method: 'POST', headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: config.from, to: [recipient], subject, html }) });
      const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
      if (response.ok) return { status: 'sent', attempts: attempt, reference: payload.id };
      lastError = payload.message || `Resend returned HTTP ${response.status}`;
      if (response.status !== 429 && response.status < 500) return { status: 'failed', attempts: attempt, error: lastError };
    } catch (error) { lastError = error instanceof Error ? error.message : 'Resend network error'; }
    if (attempt < MAX_ATTEMPTS) await new Promise(resolve => setTimeout(resolve, attempt * 300));
  }
  return { status: 'failed', attempts: MAX_ATTEMPTS, error: lastError };
}

export async function deliverEmail(recipient: string, subject: string, html: string): Promise<DeliveryResult> {
  const config = getEmailConfig();
  if (!config.configured) return { status: 'not_configured', attempts: 0, error: `Email provider not configured. Missing: ${config.missing.join(', ')}` };
  return config.provider === 'gmail' ? sendGmail(recipient, subject, html) : sendResend(recipient, subject, html);
}
