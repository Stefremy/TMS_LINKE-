-- Requests reuse audit_log, like quotations. These indexes bound reads by tenant,
-- client and pending state without scanning unrelated shipment/billing archives.
CREATE INDEX IF NOT EXISTS client_pickup_request_client_idx
  ON public.audit_log (tenant_id, (details->>'client_id'), created_at DESC, id DESC)
  WHERE action = 'client_pickup_request';
CREATE INDEX IF NOT EXISTS client_pickup_request_status_idx
  ON public.audit_log (tenant_id, (details->>'status'), created_at DESC, id DESC)
  WHERE action = 'client_pickup_request';
