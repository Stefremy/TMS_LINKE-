-- Performance indexes to eliminate sequential scans on navigation & portal operations
-- All indexes use IF NOT EXISTS and non-destructive DDL.

-- 1. Accelerate audit_log queries for client identity, slug resolution, and statements
create index if not exists idx_audit_log_tenant_action_created
  on public.audit_log (tenant_id, action, created_at desc);

-- 2. Functional index for fast lookup of client_data by details->>id
create index if not exists idx_audit_log_details_id
  on public.audit_log (tenant_id, ((details->>'id')))
  where action in ('client_data', 'deleted_client');

-- 3. Functional index for fast lookup of billing statements by details->>client_id
create index if not exists idx_audit_log_details_client_id
  on public.audit_log (tenant_id, ((details->>'client_id')))
  where action in ('billing_statement', 'custom_invoice', 'period_statement');

-- 4. Fast lookup of shipments by tenant, client and creation date (newest first)
create index if not exists idx_shipments_tenant_client_created
  on public.shipments (tenant_id, client_id, created_at desc);

-- 5. Fast lookup of pending shipments for manifest batch closing & counts
create index if not exists idx_shipments_tenant_status
  on public.shipments (tenant_id, status);

analyze public.audit_log;
analyze public.shipments;
