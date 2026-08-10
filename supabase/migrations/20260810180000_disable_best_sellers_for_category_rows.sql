-- Category-backed rows must never use the global Top Selling source.
update public.homepage_product_sections
set use_best_sellers = false
where category_id is not null
  and use_best_sellers is true;

notify pgrst, 'reload schema';
