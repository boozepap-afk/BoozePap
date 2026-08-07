-- Update editable storefront branding without disturbing existing custom content.
update public.store_settings
set value = jsonb_set(value, '{logo_text}', '"BoozePap"'::jsonb, true)
where key = 'site_content'
  and value ->> 'logo_text' in ('ChupaHub', 'Chupa Hub');

update public.store_settings
set value = jsonb_set(value, '{name}', '"BoozePap"'::jsonb, true)
where key = 'store'
  and value ->> 'name' in ('ChupaHub', 'Chupa Hub');

update public.store_settings
set value = jsonb_set(value, '{journal_title}', '"BoozePap Journal"'::jsonb, true)
where key = 'site_content'
  and value ->> 'journal_title' in ('ChupaHub Journal', 'Chupa Hub Journal');
