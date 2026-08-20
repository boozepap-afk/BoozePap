-- Some deployments already have a riders table with an `active` column.
-- Reconcile that legacy shape with the columns used by the dispatch screen.
alter table public.riders
  add column if not exists is_active boolean,
  add column if not exists updated_at timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'riders'
      and column_name = 'active'
  ) then
    execute 'update public.riders set is_active = coalesce(is_active, active, true)';
  else
    update public.riders set is_active = coalesce(is_active, true);
  end if;
end
$$;

update public.riders
set updated_at = coalesce(updated_at, created_at, now());

alter table public.riders
  alter column is_active set default true,
  alter column is_active set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

notify pgrst, 'reload schema';
