-- Run this in Supabase SQL Editor for CRM cloud sync.

create table if not exists public.crm_records (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.crm_records enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.crm_records to anon, authenticated;

drop policy if exists crm_records_rw_anon on public.crm_records;
create policy crm_records_rw_anon
on public.crm_records
for all
to anon
using (true)
with check (true);

notify pgrst, 'reload schema';
