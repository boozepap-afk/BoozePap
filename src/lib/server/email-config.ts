export type EmailProvider = 'gmail' | 'resend';
export type EmailProviderStatus = 'not_configured' | 'configured';

export function getEmailConfig() {
  const requested = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  const provider: EmailProvider | null = requested === 'gmail' || requested === 'resend'
    ? requested
    : process.env.RESEND_API_KEY?.trim() ? 'resend' : null;
  const from = process.env.EMAIL_FROM?.trim();
  const adminEmail = process.env.ADMIN_ORDER_EMAIL?.trim();
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.trim();
  const missing = provider === 'gmail'
    ? [!gmailUser ? 'GMAIL_USER' : null, !gmailAppPassword ? 'GMAIL_APP_PASSWORD' : null]
    : provider === 'resend'
      ? [!resendApiKey ? 'RESEND_API_KEY' : null, !from ? 'EMAIL_FROM' : null]
      : ['EMAIL_PROVIDER'];
  const requiredMissing = missing.filter((value): value is string => Boolean(value));
  const configured = provider !== null && requiredMissing.length === 0;
  return { provider, from, adminEmail, resendApiKey, gmailUser, gmailAppPassword, configured, missing: requiredMissing, status: (configured ? 'configured' : 'not_configured') as EmailProviderStatus };
}

export function safeEmailStatus() {
  const config = getEmailConfig();
  return {
    configured: config.configured,
    status: config.status,
    provider: config.provider,
    fromConfigured: config.provider === 'gmail' ? Boolean(config.gmailUser) : Boolean(config.from),
    adminRecipientConfigured: Boolean(config.adminEmail),
    missing: config.missing,
  };
}
