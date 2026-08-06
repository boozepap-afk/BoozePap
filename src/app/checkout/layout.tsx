import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Secure Checkout – Nairobi Alcohol Delivery',
  description: 'Complete your Chupa Hub order for fast wine, whisky and alcohol delivery in Nairobi using M-Pesa, card or cash.',
  alternates: { canonical: '/checkout' },
  openGraph: { title: 'Secure Checkout | Chupa Hub', description: 'Complete your Nairobi alcohol delivery order securely.', url: '/checkout', type: 'website' },
  twitter: { card: 'summary', title: 'Secure Checkout | Chupa Hub', description: 'Complete your Nairobi alcohol delivery order securely.' },
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) { return children; }
