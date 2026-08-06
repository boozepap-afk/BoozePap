-- Configurable homepage product sections and safe stock adjustment helpers.
-- Uses existing products.stock, product_variants.stock and inventory_movements.
create table if not exists public.homepage_product_sections (
 id uuid primary key default gen_random_uuid(), heading text not null, category_id uuid references public.categories(id) on delete set null,
 product_ids uuid[] not null default '{}', use_best_sellers boolean not null default false,
 item_limit integer not null default 8 check (item_limit between 1 and 24), sort_order integer not null default 0,
 rotation_enabled boolean not null default true, rotation_seconds integer not null default 6 check (rotation_seconds between 5 and 30),
 is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.homepage_product_sections enable row level security;
grant select on public.homepage_product_sections to anon, authenticated;
grant insert, update, delete on public.homepage_product_sections to authenticated;
drop policy if exists "Public read active homepage product sections" on public.homepage_product_sections;
create policy "Public read active homepage product sections" on public.homepage_product_sections for select using (is_active or public.is_admin());
drop policy if exists "Admins manage homepage product sections" on public.homepage_product_sections;
create policy "Admins manage homepage product sections" on public.homepage_product_sections for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop trigger if exists homepage_product_sections_updated_at on public.homepage_product_sections;
create trigger homepage_product_sections_updated_at before update on public.homepage_product_sections for each row execute function public.set_updated_at();

create or replace function public.adjust_catalog_stock(p_product_id uuid, p_variant_id uuid, p_quantity_change integer, p_reason text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
 if not public.is_admin() then raise exception 'Administrator access required'; end if;
 if p_variant_id is not null then
   update public.product_variants set stock = greatest(0, stock + p_quantity_change) where id = p_variant_id;
   if not found then raise exception 'Variant not found'; end if;
 else
   update public.products set stock = greatest(0, stock + p_quantity_change) where id = p_product_id;
   if not found then raise exception 'Product not found'; end if;
 end if;
 insert into public.inventory_movements(product_id, variant_id, quantity_change, reason, note, created_by)
 values (p_product_id, p_variant_id, p_quantity_change, p_reason, p_note, auth.uid());
end $$;
revoke all on function public.adjust_catalog_stock(uuid,uuid,integer,text,text) from public;
grant execute on function public.adjust_catalog_stock(uuid,uuid,integer,text,text) to authenticated;
