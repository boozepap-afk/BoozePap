import type { Metadata } from 'next';
import Link from 'next/link';
import { absoluteUrl, breadcrumbSchema, JsonLd } from '@/lib/seo';

const title = 'Frequently Asked Questions – BoozePap Nairobi';
const description = 'Answers about BoozePap delivery, payments, product availability, customer accounts and responsible alcohol ordering in Nairobi.';
const questions = [
  ['Where does BoozePap deliver?', 'BoozePap serves configured delivery areas in and around Nairobi. Enter your location at checkout to see the applicable delivery fee.'],
  ['Can I order as a guest?', 'Yes. A customer account is optional and guest checkout remains available.'],
  ['How do I confirm my delivery location?', 'Search for your address or use your current location at checkout, then confirm the map pin before placing the order.'],
  ['What payment methods are available?', 'Available payment methods are shown at checkout and may include M-Pesa, cash on delivery or store pickup.'],
  ['Do I need to be 18 or older?', 'Yes. BoozePap sells alcohol only to adults aged 18 and over. Please drink responsibly.'],
];
export const metadata: Metadata = { title, description, alternates: { canonical: '/faq' }, openGraph: { title: `${title} | BoozePap`, description, url: '/faq', type: 'website' }, twitter: { card: 'summary', title: `${title} | BoozePap`, description } };
export default function FaqPage() { const faq = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: questions.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })), url: absoluteUrl('/faq') }; return <main className="mx-auto max-w-4xl px-4 py-10"><JsonLd data={[faq, breadcrumbSchema([{ name: 'Home', url: '/' }, { name: 'FAQ', url: '/faq' }])]}/><nav aria-label="Breadcrumb" className="mb-4 text-sm text-neutral-600"><Link href="/">Home</Link> / FAQ</nav><section className="rounded-3xl bg-white p-7 shadow-card"><p className="font-bold uppercase tracking-wide text-brand-orange">Customer care</p><h1 className="mt-2 text-4xl font-black text-brand-ink">Frequently asked questions</h1><div className="mt-6 space-y-3">{questions.map(([question, answer]) => <details key={question} className="rounded-2xl border border-orange-100 p-4"><summary className="cursor-pointer font-black text-brand-ink">{question}</summary><p className="mt-3 leading-7 text-neutral-700">{answer}</p></details>)}</div></section></main>; }
