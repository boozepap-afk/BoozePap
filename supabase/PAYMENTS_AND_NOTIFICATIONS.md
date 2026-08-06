# Chupa Hub payment, authentication, and notification configuration

## Before enabling checkout

Apply migrations through Supabase migration history, not manually:

```bash
supabase migration list --linked
supabase db push
```

Set the variables in the root `.env.example` in **Vercel → Project → Settings → Environment Variables**. Only the `NEXT_PUBLIC_SUPABASE_*` values may be exposed to the browser. `SUPABASE_SERVICE_ROLE_KEY`, Daraja, email, SMS, WhatsApp, and Google secrets are server-only values.

## M-Pesa Daraja

1. Create a sandbox app in the [Safaricom Daraja developer portal](https://developer.safaricom.co.ke/), then obtain the consumer key, consumer secret, sandbox shortcode, and Lipa na M-Pesa passkey.
2. Set `MPESA_ENVIRONMENT=sandbox` and use a public HTTPS callback URL ending in `/api/mpesa/callback`. For local sandbox testing, use an HTTPS tunnel only for the callback URL; do not commit it.
3. Configure the callback URL in Daraja and test a successful, cancelled (`1032`), and timed-out (`1037`) STK prompt. The callback route is idempotent: duplicate callbacks do not mark an already-paid payment again.
4. Switch to production only after Safaricom has issued production credentials and accepted the production callback URL. Do not claim payment is live before this verification.

The checkout server recalculates item prices and stock from Supabase and calculates delivery from server-side delivery bands. It never accepts a browser-provided total.

## Authentication

In Supabase Auth, enable Email and Google, set the **Site URL** to `https://chupahub.com`, and add these redirect URLs to the Auth configuration:

- `https://chupahub.com/auth/callback`
- `https://www.chupahub.com/auth/callback`
- `https://*.vercel.app/auth/callback`
- `http://localhost:3000/auth/callback` (development only)

Create the Google OAuth client in Google Cloud Console and use **Supabase's provider callback URL** as its authorized redirect URI: `https://zoiafygddwqwjqvaahtb.supabase.co/auth/v1/callback`. Do not add a Chupa Hub `/auth/callback` URL to Google Cloud; those application callback URLs belong in Supabase's redirect allow list. Place the Google client ID and secret only in the Supabase Google provider settings.

Vercel's `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must both belong to that same Supabase project. Remove old credentials from every Vercel environment before redeploying. Never expose the service-role key in a `NEXT_PUBLIC_` variable.

## Notifications

`admin_notifications` always records new-order and confirmed-payment events for the secure admin dashboard. Resend order email uses the server-only `RESEND_API_KEY`, `EMAIL_FROM`, and `ADMIN_ORDER_EMAIL` variables. `EMAIL_PROVIDER=resend` is optional because the application detects Resend when an API key is present. Configure Africa's Talking or another approved provider only after valid credentials are available. WhatsApp requires a Meta Cloud API access token, phone-number ID, and approved templates where Meta requires them.

No SMS, WhatsApp, or email credentials are included in this repository. Until a provider integration and verified credentials are configured, use the in-dashboard notification record and do not claim external messages were sent.

## Google Maps delivery search

Create a browser API key in Google Cloud Console and enable **Maps JavaScript API**, **Places API (New)**, and **Geocoding API**. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in Vercel. Restrict the key to HTTP referrers for the exact Chupa Hub production domain, approved Vercel preview domains, and `http://localhost:3000/*` only when developing. Apply API restrictions so the key can call only those three APIs. The key is intentionally browser-visible; its referrer and API restrictions are mandatory. Checkout stores the selected Google Place ID, place name, formatted address, coordinates, and verification state. Manual fallback orders are visibly stored as unverified.
