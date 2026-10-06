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
