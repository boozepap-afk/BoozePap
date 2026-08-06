-- Premium customer dashboard, saved-address details, and idempotent rewards.
alter table public.delivery_locations add column if not exists apartment text;
alter table public.delivery_locations add column if not exists building text;
alter table public.delivery_locations add column if not exists delivery_instructions text;
alter table public.delivery_locations add column if not exists place_id text;
alter table public.delivery_locations add column if not exists place_name text;
alter table public.orders add column if not exists delivered_at timestamptz;

create table if not exists public.reward_accounts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid unique not null references public.customers(id) on delete cascade,
  points_balance integer not null default 0 check (points_balance >= 0),
  lifetime_points integer not null default 0 check (lifetime_points >= 0),
  points_redeemed integer not null default 0 check (points_redeemed >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_transactions (
  id uuid primary key default gen_random_uuid(),
  reward_account_id uuid not null references public.reward_accounts(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  transaction_type text not null check (transaction_type in ('order_earned','refund_reversal','redemption','admin_adjustment','bonus')),
  points integer not null check (points <> 0),
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists reward_transactions_order_type_key on public.reward_transactions(order_id, transaction_type) where order_id is not null;
create index if not exists reward_transactions_account_created_idx on public.reward_transactions(reward_account_id, created_at desc);

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_account_id uuid not null references public.reward_accounts(id) on delete cascade,
  points integer not null check (points > 0),
  reward_name text not null,
  status text not null default 'pending' check (status in ('pending','approved','used','cancelled')),
  redeemed_at timestamptz not null default now(),
  used_at timestamptz
);

alter table public.reward_accounts enable row level security;
alter table public.reward_transactions enable row level security;
alter table public.reward_redemptions enable row level security;

drop policy if exists "Customers read own reward account" on public.reward_accounts;
create policy "Customers read own reward account" on public.reward_accounts for select to authenticated using (public.is_admin() or customer_id in (select id from public.customers where user_id = auth.uid()));
drop policy if exists "Admins manage reward accounts" on public.reward_accounts;
create policy "Admins manage reward accounts" on public.reward_accounts for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Customers read own reward transactions" on public.reward_transactions;
create policy "Customers read own reward transactions" on public.reward_transactions for select to authenticated using (public.is_admin() or reward_account_id in (select ra.id from public.reward_accounts ra join public.customers c on c.id=ra.customer_id where c.user_id=auth.uid()));
drop policy if exists "Admins manage reward transactions" on public.reward_transactions;
create policy "Admins manage reward transactions" on public.reward_transactions for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Customers read own reward redemptions" on public.reward_redemptions;
create policy "Customers read own reward redemptions" on public.reward_redemptions for select to authenticated using (public.is_admin() or reward_account_id in (select ra.id from public.reward_accounts ra join public.customers c on c.id=ra.customer_id where c.user_id=auth.uid()));
drop policy if exists "Admins manage reward redemptions" on public.reward_redemptions;
create policy "Admins manage reward redemptions" on public.reward_redemptions for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.apply_order_reward_points() returns trigger
language plpgsql security definer set search_path=public as $$
declare account_id uuid; earned integer; inserted_id uuid; earned_points integer;
begin
  if new.customer_id is null then return new; end if;
  insert into public.reward_accounts(customer_id) values(new.customer_id) on conflict(customer_id) do update set updated_at=now() returning id into account_id;
  if new.status='delivered' and old.status is distinct from 'delivered' then
    earned := floor(greatest(new.total,0)/100)::integer;
    if earned > 0 then
      insert into public.reward_transactions(reward_account_id,order_id,transaction_type,points,description)
      values(account_id,new.id,'order_earned',earned,'Points earned for delivered order '||coalesce(new.order_number,new.id::text))
      on conflict do nothing returning id into inserted_id;
      if inserted_id is not null then update public.reward_accounts set points_balance=points_balance+earned,lifetime_points=lifetime_points+earned,updated_at=now() where id=account_id; end if;
    end if;
    new.delivered_at := coalesce(new.delivered_at,now());
  elsif new.status='refunded' and old.status is distinct from 'refunded' then
    select points into earned_points from public.reward_transactions where order_id=new.id and transaction_type='order_earned';
    if coalesce(earned_points,0)>0 then
      insert into public.reward_transactions(reward_account_id,order_id,transaction_type,points,description)
      values(account_id,new.id,'refund_reversal',-earned_points,'Points removed for refunded order '||coalesce(new.order_number,new.id::text))
      on conflict do nothing returning id into inserted_id;
      if inserted_id is not null then update public.reward_accounts set points_balance=greatest(0,points_balance-earned_points),updated_at=now() where id=account_id; end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists orders_apply_reward_points on public.orders;
create trigger orders_apply_reward_points before update of status on public.orders for each row execute function public.apply_order_reward_points();

create or replace function public.adjust_reward_points(target_customer_id uuid, point_delta integer, adjustment_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare account_id uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if point_delta=0 then raise exception 'Adjustment cannot be zero'; end if;
  insert into public.reward_accounts(customer_id) values(target_customer_id) on conflict(customer_id) do update set updated_at=now() returning id into account_id;
  if (select points_balance from public.reward_accounts where id=account_id)+point_delta < 0 then raise exception 'Adjustment exceeds available balance'; end if;
  insert into public.reward_transactions(reward_account_id,transaction_type,points,description,created_by) values(account_id,'admin_adjustment',point_delta,coalesce(adjustment_note,'Admin adjustment'),auth.uid());
  update public.reward_accounts set points_balance=points_balance+point_delta,lifetime_points=lifetime_points+greatest(point_delta,0),updated_at=now() where id=account_id;
end $$;
grant execute on function public.adjust_reward_points(uuid,integer,text) to authenticated;

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_item_id uuid unique not null references public.order_items(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  review text,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.product_reviews enable row level security;
drop policy if exists "Customers manage own reviews" on public.product_reviews;
create policy "Customers manage own reviews" on public.product_reviews for all to authenticated using (public.is_admin() or customer_id in (select id from public.customers where user_id=auth.uid())) with check (public.is_admin() or customer_id in (select id from public.customers where user_id=auth.uid()));
