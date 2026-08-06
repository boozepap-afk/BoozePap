import { CheckoutClient } from '@/components/CheckoutClient';
import { getCheckoutSettings, getDeliverySettings } from '@/lib/supabase';

export default async function Checkout() {
  const [settings, bands] = await Promise.all([getCheckoutSettings(), getDeliverySettings()]);
  return <CheckoutClient settings={settings} bands={bands} />;
}
