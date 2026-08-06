export type BrandPartner = {
  id: string;
  name: string;
  image_url: string;
};

/** Initial partner artwork can be replaced at any time from Website Content. */
export const defaultBrandPartners: BrandPartner[] = [
  { id: 'eabl', name: 'EABL', image_url: 'https://logo.clearbit.com/eabl.com' },
  { id: 'kwal', name: 'KWAL', image_url: 'https://logo.clearbit.com/kwal.co.ke' },
  { id: 'heineken', name: 'Heineken', image_url: 'https://logo.clearbit.com/heineken.com' },
  { id: 'hennessy', name: 'Hennessy', image_url: 'https://logo.clearbit.com/hennessy.com' },
  { id: 'william-grant-and-sons', name: 'William Grant & Sons', image_url: 'https://logo.clearbit.com/williamgrant.com' },
  { id: 'glenbrynth', name: 'Glenbrynth', image_url: 'https://logo.clearbit.com/glenbrynth.co.za' },
];
