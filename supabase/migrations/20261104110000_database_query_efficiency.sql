-- Metadata-only capability detection and indexes for the existing legacy store.
-- No tables are substituted, no operational data or credentials are moved.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

CREATE INDEX IF NOT EXISTS audit_log_action_created_idx
  ON public.audit_log(action, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS audit_log_tenant_action_created_idx
  ON public.audit_log(tenant_id, action, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS audit_log_tenant_action_entity_idx
  ON public.audit_log(tenant_id, action, (details->>'id'), created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS audit_log_tenant_action_shipment_idx
  ON public.audit_log(tenant_id, action, (details->>'shipment_id'), created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS audit_log_shipment_client_idx
  ON public.audit_log(tenant_id, (details->>'client_id'), created_at DESC, id DESC)
  WHERE action = 'shipment_data';
CREATE INDEX IF NOT EXISTS audit_log_shipment_tracking_idx
  ON public.audit_log(tenant_id, (details->>'tracking_number'))
  WHERE action = 'shipment_data';

CREATE OR REPLACE FUNCTION public.linke_schema_capabilities()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT jsonb_build_object(
    'carrier_connections', to_regclass('public.carrier_connections') IS NOT NULL,
    'colaboradores', to_regclass('public.colaboradores') IS NOT NULL,
    'servicos_linke', to_regclass('public.servicos_linke') IS NOT NULL,
    'user_profiles', to_regclass('public.user_profiles') IS NOT NULL,
    'shipments.ctt_manifest_pdf', EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = to_regclass('public.shipments')
        AND attname = 'ctt_manifest_pdf' AND NOT attisdropped
    )
  );
$$;
REVOKE ALL ON FUNCTION public.linke_schema_capabilities() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.linke_schema_capabilities() TO service_role;
COMMIT;
NOTIFY pgrst, 'reload schema';
