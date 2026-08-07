# BoozePap migration conflict audit

## The two overlapping schema uploads

The older upload is `20260715120000_chupahub_core.sql`. The replacement upload
is `20260716160000_supabase_storefront_admin.sql`. They are not two independent
migrations: the latter recreates the same core schema and then adds the
storefront/admin fields and safer, explicitly authenticated policies.

Keep the second upload in historical migration history. Do not manually rerun
either upload on an existing project. Use migration history to determine what
already ran, then apply only the forward reconciliation migration
`20260727120000_reconcile_current_storefront_schema.sql`.

## File-by-file findings

### Duplicate tables

Both uploads create `categories`, `brands`, `products`, `customers`,
`delivery_locations`, `orders`, `order_items`, `promotions`,
`homepage_banners`, and `admin_users`. The replacement additionally creates
`delivery_settings`.

### Duplicate and differing columns

All columns from the older upload are repeated by the replacement. The
replacement adds:

| Table | Additional columns in replacement upload |
| --- | --- |
| `categories` | `description text`, `color text` |
| `products` | `short_description text`, `currency text default 'KES'`, `sort_order integer` |
| `orders` | `payment_reference text`, `admin_notes text` |
| `promotions` | `image_url text`, `badge_text text`, `button_label text`, `button_url text`, `sort_order integer` |
| `homepage_banners` | `mobile_image_url text`, `badge_text text` |

The shared columns use compatible types in both files. Later forward
migrations add the current-code fields: product SEO, inventory, tasting,
pairing and scheduled-discount fields; variant discount fields; Google
delivery fields; and order/payment/notification fields. Those later fields
must not be replaced by either core upload.

### RLS conflicts

The older upload creates policies without dropping an existing policy of the
same name and does not consistently restrict administrative policies to the
`authenticated` role. Rerunning it can fail on duplicate policy names. The
replacement drops/recreates named policies, explicitly scopes administrative
writes to `authenticated`, adds admin read policies, and adds delivery-setting
policies. The replacement policy definitions are authoritative.

The public storefront requires anon `SELECT` access plus active/public-row RLS
policies for `products`, `categories`, `brands`, `product_variants`,
`homepage_banners`, `promotions`, `delivery_settings`, `store_settings`, and
`homepage_product_sections`.

### Old seed data

`20260716161000_seed_existing_storefront.sql` is a separate legacy seed. It
formerly inserted the old four-product storefront (Jameson, Tanqueray, Moët,
and Schweppes), old categories, a banner, promotions, and delivery bands. Its
INSERT statements are now disabled so a new migration run cannot restore the
previous look. It must not be manually rerun in production. The final
reconciliation migration contains no seed products, categories, banners,
promotions, or website settings.

### Duplicate settings and catalogue content

Later migrations insert or update `store_settings` keys such as
`site_content`, `homepage_sections`, and `checkout`. Their upserts are intended
forward changes, not an instruction to rerun the core or legacy seed files.
The requested-spirit migration also upserts catalogue records by stable slug;
it should be applied once through migration history, never used as a general
database reset.

## Files that must not be manually run again

* `20260715120000_chupahub_core.sql` — superseded core upload.
* `20260716160000_supabase_storefront_admin.sql` — authoritative historical
  replacement, but not a repair script.
* `20260716161000_seed_existing_storefront.sql` — legacy visual/catalogue seed.
* Any migration already recorded by `supabase migration list --linked`.

No migration in this repository should be rerun blindly. The final
reconciliation is additive, does not truncate tables, and does not insert
catalogue or website-content rows.
