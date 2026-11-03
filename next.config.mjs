const categoryRedirects = ['beer', 'wine', 'whisky', 'gin', 'vodka', 'champagne', 'spirits', 'mixers', 'brandy', 'tequila', 'rum', 'liqueur', 'liqueurs', 'sparkling', 'snacks'];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { qualities: [50, 75], remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  poweredByHeader: false,
  async redirects() {
    return [
      { source: '/favicon.ico', destination: '/boozepap-icon.svg', permanent: true },
      ...categoryRedirects.map((slug) => ({
      source: `/category/${slug}`,
      destination: `/${slug === 'liqueurs' ? 'liqueur' : slug}`,
      permanent: true,
      })),
    ];
  },
};
export default nextConfig;
