import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'BoozePap Commerce Administration',
  description: 'Secure BoozePap catalog, inventory, order and promotion administration.',
  alternates: { canonical: '/admin' },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) { return children; }
