-- Add editable, visible social and journal content without overwriting an
-- administrator's existing site_content values.
update public.store_settings
set value = value || '{
  "instagram_url":"",
  "facebook_url":"",
  "tiktok_url":"",
  "whatsapp_url":"",
  "journal_title":"ChupaHub Journal",
  "journal_intro":"Discover practical guides to choosing wine, whisky, beer and party drinks for every Nairobi occasion. Explore responsibly, compare styles and find the right bottle for your celebration."
}'::jsonb,
description = 'Editable shared website text, social links, journal content, header, footer and contact details.'
where key = 'site_content';
