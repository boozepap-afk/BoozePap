-- Legacy storefront seed intentionally disabled.
--
-- This version formerly inserted the four-product demonstration catalogue
-- (Jameson, Tanqueray, Moet and Schweppes), demonstration categories, a banner,
-- promotions and delivery bands. Applying that content makes a new or repaired
-- database resemble the previous website and can hide missing live catalogue
-- data. Production content must be created through the admin or an explicitly
-- reviewed catalogue import instead.
--
-- Keep this migration version in the repository so linked migration history
-- remains understandable, but do not restore the old INSERT statements.
do $$
begin
  raise notice 'Skipping disabled ChupaHub legacy storefront seed.';
end;
$$;
