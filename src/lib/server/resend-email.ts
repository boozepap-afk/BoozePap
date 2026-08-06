import { getEmailConfig } from '@/lib/server/email-config';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const MAX_ATTEMPTS = 3;

/** Low-level Resend transport shared by order notifications and the admin
 * connection test. Keeping this separate avoids coupling API routes to the
 * order-template module and gives Turbopack an unambiguous named export. */
export async function deliverEmail(recipient: string, subject: string, html: string) {
  const config = getEmailConfig();
  if (!config.configured || !config.apiKey || !config.from) return { status: 'not_configured' as const, attempts: 0, error: `Email provider not configured. Missing: ${config.missing.join(', ') || 'EMAIL_PROVIDER=resend'}` };
  let lastError = 'Email delivery failed';
  let attempts = 0;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    attempts = attempt;
    try {
      const response = await fetch(RESEND_ENDPOINT, { method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: config.from, to: [recipient], subject, html }) });
      const payload = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string; code?: string };
      if (response.ok) return { status: 'sent' as const, attempts: attempt, reference: payload.id };
      lastError = payload.message || `Resend returned HTTP ${response.status}`;
      console.error('[Resend] request rejected', { name: payload.name || 'ResendError', message: lastError, httpStatus: response.status, providerCode: payload.code || null });
      if (response.status !== 429 && response.status < 500) break;
    } catch (error) { lastError = error instanceof Error ? error.message : 'Network error while sending email'; }
    if (attempt < MAX_ATTEMPTS) await new Promise(resolve => setTimeout(resolve, attempt * 300));
  }
  return { status: 'failed' as const, attempts, error: lastError };
}
