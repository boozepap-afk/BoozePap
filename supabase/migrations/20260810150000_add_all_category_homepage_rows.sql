-- Add a homepage row for every active category without replacing existing rows.
create or replace function public.add_missing_category_homepage_sections()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare inserted_count integer;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  insert into public.homepage_product_sections
    (heading, category_id, product_ids, use_best_sellers, item_limit, sort_order, rotation_enabled, destination_url, is_active)
  select c.name, c.id, '{}'::uuid[], false, 8,
    coalesce((select max(s.sort_order) from public.homepage_product_sections s), 0) + row_number() over (order by c.name),
    false, '/category/' || c.slug, true
  from public.categories c
  where c.is_active
    and not exists (
      select 1 from public.homepage_product_sections existing
      where existing.category_id = c.id
    );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.add_missing_category_homepage_sections() from public;
grant execute on function public.add_missing_category_homepage_sections() to authenticated;

select public.add_missing_category_homepage_sections();
notify pgrst, 'reload schema';
