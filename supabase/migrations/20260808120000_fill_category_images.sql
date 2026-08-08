-- Give every standard storefront category cover artwork while preserving custom uploads.
update public.categories as category
set image_url = artwork.image_url,
    updated_at = now()
from (values
  ('wine', 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=900&q=85'),
  ('gin', 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?auto=format&fit=crop&w=900&q=85'),
  ('whisky', 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=900&q=85'),
  ('whiskey', 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=900&q=85'),
  ('vodka', 'https://images.unsplash.com/photo-1605270012917-bf157c5a9541?auto=format&fit=crop&w=900&q=85'),
  ('beer', 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=900&q=85'),
  ('brandy', 'https://images.unsplash.com/photo-1614313511387-1436a4480ebb?auto=format&fit=crop&w=900&q=85'),
  ('tequila', 'https://images.unsplash.com/photo-1563223771-375783ee91ad?auto=format&fit=crop&w=900&q=85'),
  ('rum', 'https://images.unsplash.com/photo-1582819509237-d5b75c4c3b0d?auto=format&fit=crop&w=900&q=85'),
  ('liqueur', 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=900&q=85'),
  ('sparkling', 'https://images.unsplash.com/photo-1567696911980-2eed69a46042?auto=format&fit=crop&w=900&q=85'),
  ('champagne', 'https://images.unsplash.com/photo-1567696911980-2eed69a46042?auto=format&fit=crop&w=900&q=85'),
  ('mixers', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=85'),
  ('soft-drinks', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=85'),
  ('snacks', 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?auto=format&fit=crop&w=900&q=85'),
  ('spirits', 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=900&q=85')
) as artwork(slug, image_url)
where category.slug = artwork.slug
  and nullif(btrim(category.image_url), '') is null;
