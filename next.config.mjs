const categoryRedirects = ['beer', 'wine', 'whisky', 'gin', 'vodka', 'champagne', 'spirits', 'mixers', 'brandy', 'tequila', 'rum', 'liqueur', 'liqueurs', 'sparkling', 'snacks'];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  poweredByHeader: false,
  async redirects() {
    return [
      { source: '/favicon.ico', destination: '/favicon.svg', permanent: true },
      ...categoryRedirects.map((slug) => ({
      source: `/category/${slug}`,
      destination: `/${slug === 'liqueurs' ? 'liqueur' : slug}`,
      permanent: true,
      })),
    ];
  },
};
export default nextConfig;
