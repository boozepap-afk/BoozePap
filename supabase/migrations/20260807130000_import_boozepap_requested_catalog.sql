-- Idempotent import of the BoozePap catalog supplied by the store owner.
-- Uses the copied ChupaHub products schema: stock and is_active are the only
-- inventory/publication fields, and category_id points at existing categories.
do $$
declare
  item jsonb;
  v_category_id uuid;
begin
  if exists (
    select 1 from unnest(array['gin','vodka','sparkling','wine']) slug
    where not exists (select 1 from public.categories c where c.slug = slug)
  ) then
    raise exception 'Catalog import requires existing gin, vodka, sparkling, and wine categories';
  end if;

  for item in select value from jsonb_array_elements($catalog$
  [
    {"category":"gin","name":"Beefeater London Dry Gin","slug":"beefeater-london-dry-gin-1l","size":"1L","price":1800,"stock":2},
    {"category":"gin","name":"Broker’s Gin","slug":"brokers-gin-1l","size":"1L","price":2200,"stock":2},
    {"category":"gin","name":"Antidote Gin","slug":"antidote-gin-700ml","size":"700ml","price":2500,"stock":2},
    {"category":"gin","name":"Antidote Orange Gin","slug":"antidote-orange-gin-700ml","size":"700ml","price":2500,"stock":2},
    {"category":"gin","name":"Antidote Rosé Gin","slug":"antidote-rose-gin-700ml","size":"700ml","price":2500,"stock":2},
    {"category":"gin","name":"G’Vine Floraison Gin","slug":"gvine-floraison-gin-1l","size":"1L","price":3900,"stock":2},
    {"category":"gin","name":"Only Premium Gin","slug":"only-premium-gin-700ml","size":"700ml","price":4200,"stock":2},
    {"category":"gin","name":"Solo Aviator Gin","slug":"solo-aviator-gin-750ml","size":"750ml","price":1900,"stock":10},
    {"category":"gin","name":"Stranger & Sons Gin","slug":"stranger-and-sons-gin-1l","size":"1L","price":4000,"stock":2},
    {"category":"gin","name":"Tann’s Gin","slug":"tanns-gin-750ml","size":"750ml","price":3600,"stock":2},
    {"category":"gin","name":"An Dúlamán Irish Maritime Gin","slug":"an-dulaman-irish-maritime-gin-500ml","size":"500ml","price":4000,"stock":10},
    {"category":"gin","name":"An Dúlamán Memories of Asia Gin","slug":"an-dulaman-memories-of-asia-gin-500ml","size":"500ml","price":4000,"stock":10},

    {"category":"vodka","name":"Absolut Peppar","slug":"absolut-peppar-750ml","size":"750ml","price":1300,"stock":10},
    {"category":"vodka","name":"Belvedere Citrus","slug":"belvedere-citrus-750ml","size":"750ml","price":3000,"stock":10},
    {"category":"vodka","name":"Belvedere Grapefruit","slug":"belvedere-grapefruit-750ml","size":"750ml","price":3000,"stock":10},
    {"category":"vodka","name":"Belvedere Mango","slug":"belvedere-mango-750ml","size":"750ml","price":3000,"stock":10},
    {"category":"vodka","name":"Belvedere Organic Vodka","slug":"belvedere-organic-vodka-1l","size":"1L","price":4800,"stock":10},
    {"category":"vodka","name":"Belvedere Peach Nectar","slug":"belvedere-peach-nectar-750ml","size":"750ml","price":3000,"stock":10},
    {"category":"vodka","name":"Cîroc Vodka","slug":"ciroc-vodka-750ml","size":"750ml","price":4600,"stock":10},
    {"category":"vodka","name":"Roberto Cavalli Vodka","slug":"roberto-cavalli-vodka-1l","size":"1L","price":4800,"stock":2},

    {"category":"sparkling","name":"Beau Joie Brut Champagne","slug":"beau-joie-brut-champagne-750ml","size":"750ml","price":8000,"stock":2},
    {"category":"sparkling","name":"Bollinger Special Cuvée","slug":"bollinger-special-cuvee-750ml","size":"750ml","price":9600,"stock":10},
    {"category":"sparkling","name":"Dom Pérignon Rosé","slug":"dom-perignon-rose-750ml","size":"750ml","price":55268,"stock":10},
    {"category":"sparkling","name":"J. Charpentier Champagne Brut","slug":"j-charpentier-champagne-brut-750ml","size":"750ml","price":7200,"stock":10},
    {"category":"sparkling","name":"Laurent-Perrier Rosé","slug":"laurent-perrier-rose-750ml","size":"750ml","price":12100,"stock":10},
    {"category":"sparkling","name":"Mumm Cordon Rouge","slug":"mumm-cordon-rouge-750ml","size":"750ml","price":7000,"stock":2},
    {"category":"sparkling","name":"Taittinger Champagne","slug":"taittinger-champagne-750ml","size":"750ml","price":7000,"stock":10},
    {"category":"sparkling","name":"Piper-Heidsieck Brut","slug":"piper-heidsieck-brut-750ml","size":"750ml","price":7000,"stock":10},
    {"category":"sparkling","name":"Piper-Heidsieck Rosé","slug":"piper-heidsieck-rose-750ml","size":"750ml","price":8000,"stock":10},
    {"category":"sparkling","name":"Prince Laurent Champagne","slug":"prince-laurent-champagne-750ml","size":"750ml","price":7000,"stock":10},

    {"category":"wine","name":"4th Street White","slug":"4th-street-white-750ml","size":"750ml","price":680,"stock":10},
    {"category":"wine","name":"4th Street Red","slug":"4th-street-red-750ml","size":"750ml","price":680,"stock":10},
    {"category":"wine","name":"Drostdy-Hof Claret","slug":"drostdy-hof-claret-750ml","size":"750ml","price":800,"stock":10},
    {"category":"wine","name":"Nederburg Baronne","slug":"nederburg-baronne-750ml","size":"750ml","price":1200,"stock":10},
    {"category":"wine","name":"Four Cousins White","slug":"four-cousins-white-1-5l","size":"1.5L","price":1400,"stock":10}
  ]
  $catalog$::jsonb)
  loop
    select id into v_category_id from public.categories where slug = item->>'category';

    insert into public.products (
      category_id, name, slug, description, bottle_size, price, stock,
      is_active, is_new_arrival, track_inventory
    ) values (
      v_category_id,
      item->>'name',
      item->>'slug',
      format('%s %s.', item->>'name', item->>'size'),
      item->>'size',
      (item->>'price')::numeric,
      (item->>'stock')::integer,
      true,
      true,
      true
    )
    on conflict (slug) do update set
      category_id = excluded.category_id,
      name = excluded.name,
      description = excluded.description,
      bottle_size = excluded.bottle_size,
      price = excluded.price,
      stock = excluded.stock,
      is_active = true,
      is_new_arrival = true,
      track_inventory = true,
      updated_at = now();
  end loop;
end $$;
