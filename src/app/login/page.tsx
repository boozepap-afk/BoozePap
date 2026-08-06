import type { Metadata } from 'next';
import { LoginForm } from '@/components/account/LoginForm';

export const metadata: Metadata = { title: 'Customer login', robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="mx-auto max-w-lg px-4 py-12"><LoginForm initialError={error}/></main>;
}
