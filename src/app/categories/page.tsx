import type { Metadata } from 'next';
import { CategoryGrid } from '@/components/Site';
import { getCategories } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Shop by Category | BoozePap',
  description: 'Browse BoozePap drink categories.',
  alternates: { canonical: 'https://boozepap.com/categories' },
};

export default async function CategoriesPage() {
  const categories = await getCategories();
  return <main className="min-h-[60vh] bg-white">
    <section className="px-4 pt-8 text-center sm:px-6">
      <h1 className="text-3xl font-black text-brand-ink">Shop by category</h1>
      <p className="mt-2 text-sm text-neutral-500">Choose a category to see its products.</p>
    </section>
    <CategoryGrid categories={categories.filter(category => !category.parent_id)} />
  </main>;
}
