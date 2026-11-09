-- Migration: WhatsApp & SMS Communications (Auto-Notifications, Templates, ClickSend SMS & Logs)
-- Supports dual-source operation: Legacy TMS HTML/Datatable Scraping + Native TMS Linke (public.shipments)

create table if not exists public.whatsapp_logs (
  id bigserial primary key,
  tenant_id uuid not null default '11111111-1111-1111-1111-111111111111',
  created_at timestamptz not null default now(),
  direction text not null default 'out',
  channel text not null default 'template',
  to_number text not null,
  contact_name text,
  message_text text,
  template_name text,
  status text,
  api_message_id text,
  shipment_id uuid references public.shipments(id) on delete set null,
  tracking_number text,
  source_system text default 'manual',
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_whatsapp_logs_created_at
  on public.whatsapp_logs (created_at desc);

create index if not exists idx_whatsapp_logs_to_number
  on public.whatsapp_logs (to_number, created_at desc);

create index if not exists idx_whatsapp_logs_api_message_id
  on public.whatsapp_logs (api_message_id)
  where api_message_id is not null;

create index if not exists idx_whatsapp_logs_tracking_number
  on public.whatsapp_logs (tracking_number)
  where tracking_number is not null;

create table if not exists public.whatsapp_dispatch_locks (
  id bigserial primary key,
  dispatch_key text not null unique,
  notification_type text not null check (notification_type in ('em_distribuicao', 'em_transporte', 'incidencia')),
  parcel_id text not null,
  provider_tracking_code text,
  recipient_phone text not null,
  recipient_name text,
  sender_name text,
  incident_reason text,
  source_system text not null default 'tms_linke',
  status text not null default 'sent' check (status in ('pending', 'sent', 'failed')),
  last_error text,
  run_date_key text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_dispatch_locks_type_date
  on public.whatsapp_dispatch_locks (notification_type, run_date_key, status);

create index if not exists idx_whatsapp_dispatch_locks_parcel
  on public.whatsapp_dispatch_locks (parcel_id, provider_tracking_code);

create table if not exists public.whatsapp_communications_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_logs enable row level security;
alter table public.whatsapp_dispatch_locks enable row level security;
alter table public.whatsapp_communications_config enable row level security;

drop policy if exists "Staff can read whatsapp_logs" on public.whatsapp_logs;
create policy "Staff can read whatsapp_logs"
  on public.whatsapp_logs
  for select
  to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('admin', 'employee')
  );

drop policy if exists "Staff can read whatsapp_dispatch_locks" on public.whatsapp_dispatch_locks;
create policy "Staff can read whatsapp_dispatch_locks"
  on public.whatsapp_dispatch_locks
  for select
  to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('admin', 'employee')
  );

create or replace function public.sync_whatsapp_logs_sequence()
returns void
language plpgsql
security definer
as $$
begin
  perform setval(
    pg_get_serial_sequence('public.whatsapp_logs', 'id'),
    coalesce((select max(id) from public.whatsapp_logs), 1),
    true
  );
end;
$$;

notify pgrst, 'reload schema';
