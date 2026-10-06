-- Profile data (name, phone, avatar URL...) lives here instead of auth user_metadata.
-- user_metadata is embedded in the JWT / session cookie, so large values caused
-- 494 REQUEST_HEADER_TOO_LARGE errors. Only the service role reads/writes this table.
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  phone text,
  department text,
  location text,
  avatar_url text check (avatar_url is null or length(avatar_url) <= 500),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
-- No policies on purpose: anon/authenticated cannot access it; the server uses the service role.
revoke all on public.user_profiles from anon, authenticated;
grant all on public.user_profiles to service_role;
-- Performance indexes for the hottest list/dashboard queries.
-- All are IF NOT EXISTS and non-destructive. Run in the Supabase SQL editor.

-- Shipment lists: tenant/client scoped, newest first
create index if not exists shipments_created_at_idx
  on public.shipments (created_at desc);
create index if not exists shipments_tenant_created_at_idx
  on public.shipments (tenant_id, created_at desc);
create index if not exists shipments_client_created_at_idx
  on public.shipments (client_id, created_at desc);
create index if not exists shipments_status_idx
  on public.shipments (status);

-- Tracking timeline (sidebar + detail) and dashboard incident lookup
create index if not exists tracking_events_shipment_created_idx
  on public.tracking_events (shipment_id, created_at);
create index if not exists tracking_events_event_code_idx
  on public.tracking_events (event_code, shipment_id);

-- audit_log is used as an event store (clients, deleted ids, label fallbacks)
create index if not exists audit_log_action_created_idx
  on public.audit_log (action, created_at desc);
create index if not exists audit_log_entity_created_idx
  on public.audit_log (entity_id, created_at);

-- Pickups
create index if not exists recolhas_created_at_idx
  on public.recolhas (created_at desc);
create index if not exists recolhas_status_idx
  on public.recolhas (status);

analyze public.shipments;
analyze public.tracking_events;
analyze public.audit_log;
-- Keep large labels in audit_log for printing, but omit them from list/report queries.
-- security_invoker makes the view obey the underlying table's permissions.
create or replace view public.shipment_metadata
with (security_invoker = true)
as
select
  s.id,
  s.client_id,
  s.created_at,
  s.tracking_number,
  s.carrier_tracking_number,
  s.ctt_object_id,
  (to_jsonb(s) - array['ctt_label_base64', 'ctt_manifest_pdf']) ||
    jsonb_build_object('has_label', nullif(s.ctt_label_base64, '') is not null) as details
from public.shipments s;

revoke all on public.shipment_metadata from anon, authenticated;
grant select on public.shipment_metadata to service_role;

create or replace view public.shipment_audit_metadata
with (security_invoker = true)
as
select
  id,
  tenant_id,
  action,
  created_at,
  details ->> 'client_id' as client_id,
  details ->> 'tracking_number' as tracking_number,
  details ->> 'carrier_tracking_number' as carrier_tracking_number,
  details ->> 'ctt_object_id' as ctt_object_id,
  details ->> 'reference' as reference,
  (details - array['ctt_label_base64', 'carrier_label_base64', 'labelBase64']) ||
    jsonb_build_object('has_label', coalesce(
      nullif(details ->> 'ctt_label_base64', ''),
      nullif(details ->> 'carrier_label_base64', ''),
      nullif(details ->> 'labelBase64', '')
    ) is not null) as details
from public.audit_log
where action = 'shipment_data';

revoke all on public.shipment_audit_metadata from anon, authenticated;
grant select on public.shipment_audit_metadata to service_role;

create index if not exists audit_log_shipment_data_created_at_idx
  on public.audit_log (created_at desc)
  where action = 'shipment_data';

create index if not exists audit_log_shipment_data_id_idx
  on public.audit_log ((details ->> 'id'), created_at desc)
  where action = 'shipment_data';

create index if not exists audit_log_shipment_data_client_idx
  on public.audit_log ((details ->> 'client_id'), created_at desc)
  where action = 'shipment_data';

create index if not exists shipments_tracking_number_idx on public.shipments (tracking_number);
create index if not exists shipments_carrier_tracking_number_idx on public.shipments (carrier_tracking_number);
create index if not exists shipments_ctt_object_id_idx on public.shipments (ctt_object_id);

create index if not exists audit_log_shipment_tracking_idx
  on public.audit_log ((details ->> 'tracking_number')) where action = 'shipment_data';
create index if not exists audit_log_shipment_carrier_tracking_idx
  on public.audit_log ((details ->> 'carrier_tracking_number')) where action = 'shipment_data';
create index if not exists audit_log_shipment_ctt_object_idx
  on public.audit_log ((details ->> 'ctt_object_id')) where action = 'shipment_data';
create index if not exists audit_log_shipment_reference_idx
  on public.audit_log ((details ->> 'reference')) where action = 'shipment_data';

create index if not exists audit_log_client_id_idx
  on public.audit_log ((details ->> 'id'))
  where action in ('client_data', 'deleted_client');

-- Fetch one label on demand instead of shipping an entire audit JSON document.
create or replace function public.shipment_label_by_id(shipment_id uuid)
returns table(client_id text, label text)
language sql stable security invoker
set search_path = ''
as $$
  with audit_label as (
    select a.details ->> 'client_id' as client_id,
      coalesce(
        nullif(a.details ->> 'ctt_label_base64', ''),
        nullif(a.details ->> 'carrier_label_base64', ''),
        nullif(a.details ->> 'labelBase64', '')
      ) as label
    from public.audit_log a
    where a.action = 'shipment_data'
      and a.details ->> 'id' = shipment_id::text
      and coalesce(
        nullif(a.details ->> 'ctt_label_base64', ''),
        nullif(a.details ->> 'carrier_label_base64', ''),
        nullif(a.details ->> 'labelBase64', '')
      ) is not null
    order by a.created_at desc
    limit 1
  ), db_label as (
    select s.client_id::text as client_id, nullif(s.ctt_label_base64, '') as label
    from public.shipments s where s.id = shipment_id
  )
  select coalesce(a.client_id, d.client_id), coalesce(a.label, d.label)
  from audit_label a full join db_label d on true
  where coalesce(a.label, d.label) is not null;
$$;

revoke all on function public.shipment_label_by_id(uuid) from public, anon, authenticated;
grant execute on function public.shipment_label_by_id(uuid) to service_role;
