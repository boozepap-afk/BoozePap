-- Idempotent catalog import requested for ChupaHub.
-- Products are matched by stable slug or exact case-insensitive name; variants are
-- matched by product and variant name. Existing customer, order and unrelated
-- catalog records are not changed.
-- Images are intentionally populated only by the companion verified-image script.

do $$
declare
  row jsonb;
  variant jsonb;
  v_product_id uuid;
  v_category_id uuid;
  required_categories text[] := array['sparkling', 'brandy', 'whisky', 'wine', 'liqueur', 'tequila'];
  category_slug text;
begin
  foreach category_slug in array required_categories loop
    if not exists (select 1 from public.categories where slug = category_slug) then
      raise exception 'Catalog import requires category "%"', category_slug;
    end if;
  end loop;

  for row in select value from jsonb_array_elements($catalog$
[
 {"name":"Moët & Chandon Nectar Imperial","slug":"moet-chandon-nectar-imperial","category":"sparkling","description":"Moët & Chandon Nectar Imperial champagne.","variants":[["750ml",10300]]},
 {"name":"Moët & Chandon Impérial Brut","slug":"moet-chandon-imperial-brut","category":"sparkling","description":"Moët & Chandon Impérial Brut champagne.","variants":[["750ml",8000]]},
 {"name":"Moët & Chandon Rosé","slug":"moet-chandon-rose","category":"sparkling","description":"Moët & Chandon Rosé champagne.","variants":[["750ml",11800]]},
 {"name":"Hennessy VS","slug":"hennessy-vs","category":"brandy","description":"Hennessy VS cognac.","variants":[["700ml",4800],["1L",7000]]},
 {"name":"Tamnavulin Double Cask","slug":"tamnavulin-double-cask","category":"whisky","description":"Tamnavulin Double Cask whisky.","variants":[["750ml",2800]]},
 {"name":"Asconi Red Wine 16%","slug":"asconi-red-wine-16","category":"wine","description":"Asconi red wine with 16% ABV.","abv":16,"variants":[["750ml",1400]]},
 {"name":"Southern Comfort Lime","slug":"southern-comfort-lime","category":"liqueur","description":"Southern Comfort Lime liqueur.","variants":[["750ml",1800]]},
 {"name":"Jose Cuervo Gold","slug":"jose-cuervo-gold","category":"tequila","description":"Jose Cuervo Gold tequila.","variants":[["750ml",2200],["1L",2700]]},
 {"name":"Glenfiddich 12 Years","slug":"glenfiddich-12-years","category":"whisky","description":"Glenfiddich 12 Years whisky.","variants":[["700ml",4800]]},
 {"name":"Glenfiddich 15 Years","slug":"glenfiddich-15-years","category":"whisky","description":"Glenfiddich 15 Years whisky.","variants":[["700ml",8000]]},
 {"name":"Glenfiddich 18 Years","slug":"glenfiddich-18-years","category":"whisky","description":"Glenfiddich 18 Years whisky.","variants":[["700ml",11500]]},
 {"name":"Grant’s Triple Wood","slug":"grants-triple-wood","category":"whisky","description":"Grant’s Triple Wood whisky.","variants":[["750ml with glass",1650],["1L",1900]]},
 {"name":"Jack Daniel’s Black","slug":"jack-daniels-black","category":"whisky","description":"Jack Daniel’s Black whiskey.","variants":[["375ml",1700],["1L",3400]]},
 {"name":"Jägermeister","slug":"jagermeister","category":"liqueur","description":"Jägermeister liqueur.","variants":[["700ml",2100],["1L",2650]]},
 {"name":"Jameson Black Barrel","slug":"jameson-black-barrel","category":"whisky","description":"Jameson Black Barrel whiskey.","variants":[["750ml",5200]]},
 {"name":"Jameson IPA Edition","slug":"jameson-ipa-edition","category":"whisky","description":"Jameson IPA Edition whiskey.","variants":[["750ml",4214]]},
 {"name":"Jameson Whiskey","slug":"jameson-whiskey","category":"whisky","description":"Jameson whiskey.","variants":[["750ml",2400]]},
 {"name":"Jura 12 Years","slug":"jura-12-years","category":"whisky","description":"Jura 12 Years whisky.","variants":[["750ml",8000]]},
 {"name":"Monkey Shoulder","slug":"monkey-shoulder","category":"whisky","description":"Monkey Shoulder whisky.","variants":[["700ml",3900]]},
 {"name":"Glenbrynth 3YO","slug":"glenbrynth-3yo","category":"whisky","description":"Glenbrynth 3YO whisky.","variants":[["750ml",1400]]},
 {"name":"Glenbrynth 12YO Blended Malt","slug":"glenbrynth-12yo-blended-malt","category":"whisky","description":"Glenbrynth 12YO Blended Malt whisky.","variants":[["750ml",3544]]},
 {"name":"Glenbrynth Bourbon Cask NAS","slug":"glenbrynth-bourbon-cask-nas","category":"whisky","description":"Glenbrynth Bourbon Cask NAS whisky.","variants":[["750ml",3136]]},
 {"name":"Glenbrynth Sherry Cask Single Malt","slug":"glenbrynth-sherry-cask-single-malt","category":"whisky","description":"Glenbrynth Sherry Cask Single Malt whisky.","variants":[["750ml",3136]]},
 {"name":"Glenbrynth Rum Cask Single Malt","slug":"glenbrynth-rum-cask-single-malt","category":"whisky","description":"Glenbrynth Rum Cask Single Malt whisky.","variants":[["750ml",3136]]},
 {"name":"Glenbrynth 30YO","slug":"glenbrynth-30yo","category":"whisky","description":"Glenbrynth 30YO whisky.","variants":[["750ml",30000]]},
 {"name":"Glenbrynth 40YO","slug":"glenbrynth-40yo","category":"whisky","description":"Glenbrynth 40YO whisky.","variants":[["750ml",65000]]}
]
$catalog$::jsonb) loop
    select id into v_category_id from public.categories where slug = row->>'category';
    select id into v_product_id from public.products
      where slug = row->>'slug' or lower(name) = lower(row->>'name')
      order by (slug = row->>'slug') desc limit 1;

    if v_product_id is null then
      insert into public.products (category_id, name, slug, description, abv, price, stock, is_active, is_new_arrival, track_inventory)
      values (v_category_id, row->>'name', row->>'slug', row->>'description', nullif(row->>'abv','')::numeric,
        (select min((v->>1)::numeric) from jsonb_array_elements(row->'variants') v), 1, false, true, false)
      returning id into v_product_id;
    else
      update public.products set category_id = v_category_id, name = row->>'name', description = row->>'description',
        abv = nullif(row->>'abv','')::numeric, price = (select min((v->>1)::numeric) from jsonb_array_elements(row->'variants') v),
        is_active = case when image_url is null then false else is_active end, is_new_arrival = true, track_inventory = false, updated_at = now()
      where id = v_product_id;
    end if;

    for variant in select value from jsonb_array_elements(row->'variants') loop
      if exists (select 1 from public.product_variants where product_id = v_product_id and name = variant->>0) then
        update public.product_variants set price = (variant->>1)::numeric, is_active = true, stock = greatest(stock, 1), updated_at = now()
        where product_id = v_product_id and name = variant->>0;
      else
        insert into public.product_variants (product_id, name, price, stock, is_active, sort_order)
        values (v_product_id, variant->>0, (variant->>1)::numeric, 1, true, (select count(*) from public.product_variants where product_id = v_product_id));
      end if;
    end loop;
  end loop;
end $$;
