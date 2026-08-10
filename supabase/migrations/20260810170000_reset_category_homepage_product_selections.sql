-- Earlier admin behavior automatically stored every category product ID.
-- Clear those generated selections once so admins can choose the exact products
-- that should appear in each category-backed homepage row.
update public.homepage_product_sections
set product_ids = '{}'::uuid[]
where category_id is not null
  and cardinality(coalesce(product_ids, '{}'::uuid[])) > 0;

notify pgrst, 'reload schema';
