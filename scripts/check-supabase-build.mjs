const missing = [];
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
}
if (missing.length) {
  console.error(`Cloudflare Build variables are missing: ${missing.join(', ')}. Set them from the production Supabase project in Worker Settings > Build > Variables and secrets, then retry. Runtime-only variables cannot configure the browser bundle. Never use a service-role key.`);
  process.exit(1);
}
try {
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid protocol');
} catch {
  console.error('NEXT_PUBLIC_SUPABASE_URL must be a valid Supabase API URL.');
  process.exit(1);
}
