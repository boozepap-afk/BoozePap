export type EmailProviderStatus = 'not_configured' | 'configured';

export function getEmailConfig() {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase() || (process.env.RESEND_API_KEY?.trim() ? 'resend' : null);
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const adminEmail = process.env.ADMIN_ORDER_EMAIL?.trim();
  const missing = [!apiKey ? 'RESEND_API_KEY' : null, !from ? 'EMAIL_FROM' : null].filter((value): value is string => Boolean(value));
  const configured = provider === 'resend' && missing.length === 0;
  return { provider, apiKey, from, adminEmail, configured, missing, status: (configured ? 'configured' : 'not_configured') as EmailProviderStatus };
}

export function safeEmailStatus() {
  const config = getEmailConfig();
  return {
    configured: config.configured,
    status: config.status,
    provider: config.provider,
    fromConfigured: Boolean(config.from),
    sender: config.from ? config.from.replace(/^.*<([^>]+)>.*$/, '$1') : null,
    adminRecipientConfigured: Boolean(config.adminEmail),
    missing: config.missing,
  };
}
