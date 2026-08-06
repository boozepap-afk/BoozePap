-- Secure, additive checkout support. Server routes use the service role; RLS
-- deliberately prevents public clients from reading guest orders or payments.
alter table public.orders add column if not exists order_number text;
alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists checkout_token uuid not null default gen_random_uuid();
alter table public.orders add column if not exists payment_status text not null default 'pending';
alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check check (payment_status in ('pending','pending_payment','paid','failed','cancelled','timed_out','refunded','cash_due'));
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in ('pending','pending_payment','confirmed','processing','dispatched','delivered','paid','packing','out_for_delivery','completed','cancelled','refunded'));
create unique index if not exists orders_order_number_key on public.orders(order_number) where order_number is not null;
create unique index if not exists orders_checkout_token_key on public.orders(checkout_token);

alter table public.order_items add column if not exists variant_id uuid references public.product_variants(id) on delete set null;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null, status text not null default 'pending' check (status in ('pending','paid','failed','cancelled','timed_out','refunded')),
  amount numeric(12,2) not null check (amount >= 0), phone_number text,
  merchant_request_id text unique, checkout_request_id text unique, receipt_number text unique,
  provider_result_code text, provider_result_desc text, transaction_at timestamptz,
  raw_callback jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists payments_order_idx on public.payments(order_id, created_at desc);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(), order_id uuid references public.orders(id) on delete cascade,
  kind text not null, title text not null, body text not null, is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists admin_notifications_unread_idx on public.admin_notifications(is_read, created_at desc);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(), order_id uuid references public.orders(id) on delete cascade,
  channel text not null check (channel in ('email','sms','whatsapp','in_app')),
  recipient text not null, event_key text not null, status text not null default 'pending' check (status in ('pending','sent','failed')),
  provider_message_id text, error_message text, attempts integer not null default 0,
  created_at timestamptz not null default now(), sent_at timestamptz,
  unique(order_id, channel, recipient, event_key)
);

alter table public.payments enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.notification_deliveries enable row level security;
create policy "Admins read payments" on public.payments for select using (public.is_admin());
create policy "Admins manage payments" on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins read notifications" on public.admin_notifications for select using (public.is_admin());
create policy "Admins manage notifications" on public.admin_notifications for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins read notification deliveries" on public.notification_deliveries for select using (public.is_admin());
create policy "Admins manage notification deliveries" on public.notification_deliveries for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop trigger if exists payments_updated_at on public.payments;
create trigger payments_updated_at before update on public.payments for each row execute function public.set_updated_at();

insert into public.store_settings(key, value, description, is_public) values
('notification_settings', '{"admin_email":"","admin_phone":"","admin_whatsapp":""}'::jsonb, 'Private notification recipients; configure through admin', false)
on conflict (key) do nothing;
