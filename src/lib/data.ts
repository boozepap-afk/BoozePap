import { Category, Product } from '@/types';

export const categories: Category[] = [
  { name: 'Wine', slug: 'wine', icon: '🍷', image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=700&q=80', color: 'from-red-500 to-red-900' },
  { name: 'Gin', slug: 'gin', icon: '🍸', image: 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=700&q=80', color: 'from-orange-300 to-orange-800' },
  { name: 'Whisky', slug: 'whisky', icon: '🥃', image: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=700&q=80', color: 'from-yellow-600 to-stone-900' },
  { name: 'Vodka', slug: 'vodka', icon: '🍾', image: 'https://images.unsplash.com/photo-1605270012917-bf157c5a9541?auto=format&fit=crop&w=700&q=80', color: 'from-lime-300 to-stone-700' },
  { name: 'Beer', slug: 'beer', icon: '🍺', image: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=700&q=80', color: 'from-green-400 to-green-900' },
  { name: 'Brandy', slug: 'brandy', icon: '🍹', image: 'https://images.unsplash.com/photo-1614313511387-1436a4480ebb?auto=format&fit=crop&w=700&q=80', color: 'from-amber-100 to-stone-700' },
  { name: 'Tequila', slug: 'tequila', icon: '🌵', image: 'https://images.unsplash.com/photo-1563223771-375783ee91ad?auto=format&fit=crop&w=700&q=80', color: 'from-amber-200 to-stone-700' },
  { name: 'Rum', slug: 'rum', icon: '🥃', image: 'https://images.unsplash.com/photo-1582819509237-d5b75c4c3b0d?auto=format&fit=crop&w=700&q=80', color: 'from-yellow-200 to-stone-700' },
  { name: 'Liqueur', slug: 'liqueur', icon: '🍶', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=700&q=80', color: 'from-fuchsia-300 to-purple-800' },
  { name: 'Sparkling', slug: 'sparkling', icon: '🍾', image: 'https://images.unsplash.com/photo-1567696911980-2eed69a46042?auto=format&fit=crop&w=700&q=80', color: 'from-yellow-300 to-stone-700' },
  { name: 'Mixers', slug: 'mixers', icon: '🍸', image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=700&q=80', color: 'from-teal-200 to-teal-800' },
  { name: 'Snacks', slug: 'snacks', icon: '🍿', image: 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?auto=format&fit=crop&w=700&q=80', color: 'from-yellow-100 to-orange-700' },
];

export const products: Product[] = [
  { id: 1, slug: 'jameson-irish-whiskey-750ml', name: 'Jameson Irish Whiskey', brand: 'Jameson', description: 'Triple-distilled Irish whiskey with spice, vanilla and toasted wood.', abv: 40, country: 'Ireland', bottleSize: '750ml', price: 2850, oldPrice: 3200, stock: 240, images: ['https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=900&q=80', 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=900&q=80'], category: 'whisky', rating: 4.8 },
  { id: 2, slug: 'tanqueray-london-dry-gin', name: 'Tanqueray London Dry Gin', brand: 'Tanqueray', description: 'Iconic dry gin for crisp G&Ts and premium cocktails.', abv: 43.1, country: 'United Kingdom', bottleSize: '750ml', price: 3100, oldPrice: 3500, stock: 180, images: ['https://images.unsplash.com/photo-1605270012917-bf157c5a9541?auto=format&fit=crop&w=900&q=80', 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=900&q=80'], category: 'gin', rating: 4.7 },
  { id: 3, slug: 'moet-chandon-brut', name: 'Moët & Chandon Brut', brand: 'Moët & Chandon', description: 'Elegant champagne for celebrations and corporate gifting.', abv: 12, country: 'France', bottleSize: '750ml', price: 8900, oldPrice: 9800, stock: 76, images: ['https://images.unsplash.com/photo-1594980696639-2c9f72e3bc4b?auto=format&fit=crop&w=900&q=80', 'https://images.unsplash.com/photo-1567696911980-2eed69a46042?auto=format&fit=crop&w=900&q=80'], category: 'sparkling', rating: 4.9 },
  { id: 4, slug: 'schweppes-tonic-water', name: 'Schweppes Tonic Water', brand: 'Schweppes', description: 'Classic mixer recommended with gin, whisky highballs and cocktail bundles.', abv: 0, country: 'Kenya', bottleSize: '500ml', price: 120, stock: 900, images: ['https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80', 'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=900&q=80'], category: 'mixers', rating: 4.6 },
];

export const money = (n: number) => `KES ${n.toLocaleString('en-KE')}`;
