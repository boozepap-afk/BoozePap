# Requested spirits catalog import

This import creates **26 grouped products and 31 size variants** from the supplied list. New records remain unpublished until a verified image is uploaded; the uploader activates them only after its public-URL image check succeeds. It is intentionally split into a database migration and a local-image uploader so no image is stored in Git or hotlinked from a retailer.

## Required live preflight

Before applying the migration, inspect the live project—not just repository SQL:

```sql
select id, slug, name, price, is_active, is_new_arrival, image_url
from public.products
order by name;

select pv.id, p.slug, pv.name, pv.price, pv.is_active, pv.stock
from public.product_variants pv join public.products p on p.id = pv.product_id
order by p.slug, pv.sort_order;
```

Then compare the output with `catalog-assets/requested-products.json`. If a product with a different name represents the same SKU, stop and reconcile it before migration; the migration only deduplicates exact names and stable slugs.

## Apply and upload

1. Apply `20260721120000_import_requested_spirits.sql` with the normal Supabase migration history process.
2. Download and independently verify official manufacturer packshots; put them in `catalog-assets/images/` as `<slug>.jpg`, `.png`, or `.webp`.
3. Run the safe filename/preflight check, then the upload command from the repository root:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-product-images.mjs
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-product-images.mjs --execute
```

The script queries the current products first, refuses missing products/images, uploads only to `product-images/catalog/<slug>.<ext>`, checks the resulting public URL returns an image, then writes that URL into `products.image_url`.

## Manual-review status

No Supabase credentials or verified manufacturer image files are available in this repository. Therefore **no live rows were imported, no images were uploaded, and all 26 products require image-source review** before `--execute`. This keeps image-less products unpublished rather than showing an incorrect packshot. This is deliberate: the uploader will not publish a product image that is incorrect, watermarked, retailer-branded, or hotlinked.
