create or replace function public.restore_default_homepage_sections()
returns void language plpgsql security definer set search_path = public as $$
declare wine_id uuid; gin_id uuid; beer_id uuid;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Administrator access required'; end if;
  select id into wine_id from public.categories where lower(name) in ('wine','wines') or lower(slug) in ('wine','wines') order by (lower(slug)='wine') desc limit 1;
  if wine_id is null then insert into public.categories(name,slug,is_active) values ('Wine','wine',true) returning id into wine_id; end if;
  select id into gin_id from public.categories where lower(name) in ('gin','gins') or lower(slug) in ('gin','gins') order by (lower(slug)='gin') desc limit 1;
  if gin_id is null then insert into public.categories(name,slug,is_active) values ('Gin','gin',true) returning id into gin_id; end if;
  select id into beer_id from public.categories where lower(name) in ('beer','beers') or lower(slug) in ('beer','beers') order by (lower(slug)='beer') desc limit 1;
  if beer_id is null then insert into public.categories(name,slug,is_active) values ('Beer','beer',true) returning id into beer_id; end if;
  update public.categories set is_active=true where id in (wine_id,gin_id,beer_id);
  delete from public.homepage_product_sections;
  insert into public.homepage_product_sections (heading,category_id,product_ids,use_best_sellers,item_limit,sort_order,rotation_enabled,is_active,destination_url) values
    ('Top Selling',null,'{}',true,8,1,false,true,'/collections/top-sellers'),
    ('Wines',wine_id,'{}',false,8,2,false,true,'/wine'),
    ('Gins',gin_id,'{}',false,8,3,false,true,'/gin'),
    ('Beers',beer_id,'{}',false,8,4,false,true,'/beer');
end $$;
revoke all on function public.restore_default_homepage_sections() from public;
grant execute on function public.restore_default_homepage_sections() to authenticated;
select public.restore_default_homepage_sections();
notify pgrst, 'reload schema';
