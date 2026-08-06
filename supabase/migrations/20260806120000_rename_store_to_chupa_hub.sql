-- Update legacy default branding without overwriting administrator customizations.
update public.store_settings
set value = jsonb_set(value, '{logo_text}', '"Chupa Hub"'::jsonb, true),
    updated_at = now()
where key = 'site_content'
  and value ->> 'logo_text' = 'ChupaHub';

update public.store_settings
set value = jsonb_set(value, '{name}', '"Chupa Hub"'::jsonb, true),
    updated_at = now()
where key = 'store'
  and value ->> 'name' = 'ChupaHub';

update public.store_settings
set value = jsonb_set(value, '{journal_title}', '"Chupa Hub Journal"'::jsonb, true),
    updated_at = now()
where key = 'site_content'
  and value ->> 'journal_title' = 'ChupaHub Journal';
