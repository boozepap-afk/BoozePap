import type { Metadata } from 'next';
import { absoluteUrl } from '@/lib/seo';

export type SeoPage = { title: string; heading: string; description: string; path: string; categorySlug?: string; offers?: boolean };

export const shopLinks = [
  ['Shop', '/shop'], ['Beer', '/beer'], ['Wine', '/wine'], ['Whisky', '/whisky'], ['Vodka', '/vodka'], ['Gin', '/gin'], ['Champagne', '/champagne'], ['Spirits', '/spirits'], ['Brandy', '/brandy'], ['Rum', '/rum'], ['Tequila', '/tequila'], ['Liqueur', '/liqueur'], ['Sparkling', '/sparkling'], ['Mixers', '/mixers'], ['Snacks', '/snacks'], ['Soft Drinks', '/soft-drinks'], ['Energy Drinks', '/energy-drinks'], ['Offers', '/offers'], ['Same-Day Delivery', '/same-day-delivery'], ['Alcohol Delivery Nairobi', '/alcohol-delivery-nairobi'],
] as const;

export const seoPages: Record<string, SeoPage> = {
  shop: { title: 'Shop Alcohol Online in Nairobi', heading: 'Shop Chupa Hub', description: 'Shop wine, whisky, beer, gin, vodka, champagne, spirits and mixers online with fast delivery across Nairobi.', path: '/shop' },
  beer: { title: 'Beer Delivery Nairobi – Shop Beer Online', heading: 'Beer Delivery Nairobi', description: 'Shop local and imported beer online from Chupa Hub with convenient delivery across Nairobi.', path: '/beer', categorySlug: 'beer' },
  wine: { title: 'Wine Delivery Nairobi – Shop Wine Online', heading: 'Wine Delivery Nairobi', description: 'Browse red, white, rosé and sparkling wine online for fast, responsible delivery across Nairobi.', path: '/wine', categorySlug: 'wine' },
  whisky: { title: 'Whisky Delivery Nairobi – Shop Whisky Online', heading: 'Whisky Delivery Nairobi', description: 'Shop Scotch, bourbon and world whisky online from Chupa Hub with delivery across Nairobi.', path: '/whisky', categorySlug: 'whisky' },
  gin: { title: 'Gin Delivery Nairobi – Shop Gin Online', heading: 'Gin Delivery Nairobi', description: 'Discover classic and premium gin online with mixers and convenient delivery across Nairobi.', path: '/gin', categorySlug: 'gin' },
  vodka: { title: 'Vodka Delivery Nairobi – Shop Vodka Online', heading: 'Vodka Delivery Nairobi', description: 'Shop popular and premium vodka online from Chupa Hub with fast Nairobi delivery.', path: '/vodka', categorySlug: 'vodka' },
  champagne: { title: 'Champagne Delivery Nairobi – Shop Online', heading: 'Champagne Delivery Nairobi', description: 'Browse champagne for celebrations, gifts and delivery across Nairobi.', path: '/champagne', categorySlug: 'champagne' },
  spirits: { title: 'Spirits Delivery Nairobi – Shop Spirits Online', heading: 'Spirits Delivery Nairobi', description: 'Explore brandy, cognac, tequila, rum, liqueurs and premium spirits delivered across Nairobi.', path: '/spirits', categorySlug: 'spirits' },
  brandy: { title: 'Brandy Delivery Nairobi – Shop Brandy Online', heading: 'Brandy Delivery Nairobi', description: 'Shop brandy and cognac online from Chupa Hub with responsible same-day delivery options across Nairobi.', path: '/brandy', categorySlug: 'brandy' },
  rum: { title: 'Rum Delivery Nairobi – Shop Rum Online', heading: 'Rum Delivery Nairobi', description: 'Discover white, dark and spiced rum online for cocktails, celebrations and delivery across Nairobi.', path: '/rum', categorySlug: 'rum' },
  tequila: { title: 'Tequila Delivery Nairobi – Shop Tequila Online', heading: 'Tequila Delivery Nairobi', description: 'Shop blanco, reposado and premium tequila online with convenient delivery across Nairobi.', path: '/tequila', categorySlug: 'tequila' },
  liqueur: { title: 'Liqueur Delivery Nairobi – Shop Online', heading: 'Liqueur Delivery Nairobi', description: 'Shop cream, fruit, herbal and cocktail liqueurs online with convenient delivery across Nairobi.', path: '/liqueur', categorySlug: 'liqueur' },
  sparkling: { title: 'Sparkling Wine Delivery Nairobi', heading: 'Sparkling Wine Delivery Nairobi', description: 'Shop sparkling wine online for celebrations, gifts and convenient delivery across Nairobi.', path: '/sparkling', categorySlug: 'sparkling' },
  mixers: { title: 'Mixers Delivery Nairobi – Cocktail Mixers', heading: 'Mixers Delivery Nairobi', description: 'Shop tonic, soda, juice, water and cocktail mixers online for delivery across Nairobi.', path: '/mixers', categorySlug: 'mixers' },
  softDrinks: { title: 'Soft Drinks Delivery Nairobi – Shop Online', heading: 'Soft Drinks Delivery Nairobi', description: 'Order sodas, juices, water and alcohol-free refreshments online for delivery across Nairobi.', path: '/soft-drinks', categorySlug: 'soft-drinks' },
  energyDrinks: { title: 'Energy Drinks Delivery Nairobi – Shop Online', heading: 'Energy Drinks Delivery Nairobi', description: 'Shop popular energy drinks and refreshment options online with delivery across Nairobi.', path: '/energy-drinks', categorySlug: 'energy-drinks' },
  snacks: { title: 'Party Bites & Extras Online in Nairobi', heading: 'Party Bites & Extras', description: 'Browse party accompaniments and convenient extras available for delivery with your drinks order across Nairobi.', path: '/snacks', categorySlug: 'snacks' },
  offers: { title: 'Alcohol Offers Nairobi – Discounted Drinks', heading: 'ChupaHub Offers', description: 'Browse currently discounted wine, beer, whisky, spirits and mixers available from ChupaHub.', path: '/offers', offers: true },
  sameDayDelivery: { title: 'Same-Day Alcohol Delivery Nairobi', heading: 'Same-Day Drinks Delivery', description: 'Order drinks online from ChupaHub for convenient same-day delivery in eligible Nairobi delivery areas.', path: '/same-day-delivery' },
  alcoholDeliveryNairobi: { title: 'Alcohol Delivery Nairobi – Order Drinks Online', heading: 'Alcohol Delivery Nairobi', description: 'Order wine, beer, whisky, gin, vodka, champagne and mixers online from ChupaHub for delivery across Nairobi.', path: '/alcohol-delivery-nairobi' },
};

export function pageMetadata(page: SeoPage): Metadata { return { title: page.title, description: page.description, alternates: { canonical: page.path }, openGraph: { title: `${page.title} | Chupa Hub`, description: page.description, url: page.path, type: 'website' }, twitter: { card: 'summary', title: `${page.title} | Chupa Hub`, description: page.description } }; }
export function collectionSchema(page: SeoPage, itemCount: number) { return { '@context': 'https://schema.org', '@type': 'CollectionPage', name: page.heading, description: page.description, url: absoluteUrl(page.path), numberOfItems: itemCount, isPartOf: { '@id': `${absoluteUrl('/')}#website` } }; }
