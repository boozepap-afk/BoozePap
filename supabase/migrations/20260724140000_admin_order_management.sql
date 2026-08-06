-- Additive fields for an auditable order workflow; existing orders are retained.
alter table public.orders add column if not exists dispatched_at timestamptz;
alter table public.orders add column if not exists rider_name text;
alter table public.orders add column if not exists rider_phone text;
alter table public.orders add column if not exists delivery_note text;
alter table public.orders add column if not exists tracking_url text;

create table if not exists public.order_notifications (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  channel text not null check (channel in ('email','sms','whatsapp')),
  recipient text not null, event_key text not null, status text not null default 'pending' check (status in ('pending','sent','failed','not_configured')),
  provider_reference text, error_message text, attempts integer not null default 0, sent_at timestamptz, created_at timestamptz not null default now(),
  unique(order_id, channel, recipient, event_key)
);
create index if not exists order_notifications_order_idx on public.order_notifications(order_id, created_at desc);
alter table public.order_notifications enable row level security;
create policy "Admins read order notifications" on public.order_notifications for select using (public.is_admin());
create policy "Admins manage order notifications" on public.order_notifications for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- The existing history table is preserved. Ensure all supported statuses can be
-- recorded without rewriting historic rows.
alter table public.order_status_history drop constraint if exists order_status_history_to_status_check;
