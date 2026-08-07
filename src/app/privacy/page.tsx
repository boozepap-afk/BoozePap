import type { Metadata } from 'next';
import { getSiteContent } from '@/lib/supabase';

export const metadata: Metadata = { title: 'Privacy Policy' };

export default async function PrivacyPage() {
  const content = await getSiteContent();
  return <main className="mx-auto max-w-4xl px-4 py-12"><article className="rounded-3xl bg-white p-6 shadow-card sm:p-10"><h1 className="text-4xl font-black text-brand-ink">Privacy Policy</h1><div className="mt-6 whitespace-pre-line leading-7 text-neutral-700">{content.privacy || 'Add the BoozePap privacy policy from Website content in the admin dashboard.'}</div></article></main>;
}
