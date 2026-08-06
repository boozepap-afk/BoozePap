import { SeoCollectionPage } from '@/components/SeoCollectionPage';
import { pageMetadata, seoPages } from '@/lib/seo-pages';
const page = seoPages.snacks;
export const metadata = pageMetadata(page);
export default function Page() { return <SeoCollectionPage page={page}/>; }
