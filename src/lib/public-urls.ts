export const categoryCanonicalPaths: Record<string, string> = {
  beer: '/beer',
  wine: '/wine',
  whisky: '/whisky',
  gin: '/gin',
  vodka: '/vodka',
  champagne: '/champagne',
  spirits: '/spirits',
  mixers: '/mixers',
  brandy: '/brandy',
  tequila: '/tequila',
  rum: '/rum',
  liqueur: '/liqueur',
  liqueurs: '/liqueur',
  sparkling: '/sparkling',
  snacks: '/snacks',
};

export function categorySlug(category: { slug?: string | null; name?: string | null } | string) {
  const value = typeof category === 'string' ? category : category.slug || category.name;
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function categoryCanonicalPath(category: { slug?: string | null; name?: string | null } | string) {
  const slug = categorySlug(category);
  const categoryUrl = `/${String(typeof category === 'string' ? category : category.slug || category.name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`;
  return categoryCanonicalPaths[slug] || `/category${categoryUrl}`;
}

export const stableCollectionSlugs = ['top-sellers', 'new-arrivals', 'featured'] as const;

export function stableCollectionSlug(section: { heading: string; use_best_sellers?: boolean }) {
  if (section.use_best_sellers || /top\s*seller|best\s*seller/i.test(section.heading)) return 'top-sellers';
  if (/new\s*arrival|new\s*product/i.test(section.heading)) return 'new-arrivals';
  if (/featured/i.test(section.heading)) return 'featured';
  return null;
}
