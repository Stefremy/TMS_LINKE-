-- Envios list metadata. shipment_data snapshots hold label PDFs (hundreds of KB each), and every
-- details->>'x' decompresses the whole record again. This picks the latest snapshot per shipment
-- through the (tenant_id, action, details->>'id', created_at) index and decompresses it once.
-- Read-only; additive.
CREATE OR REPLACE FUNCTION public.shipment_list_metadata(p_tenant uuid, p_ids text[])
RETURNS TABLE (shipment_id text, recipient_country text, recipient_postal text, is_return jsonb, "isReturn" jsonb, driver_id text, driver_name text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT i.id, m.recipient_country, m.recipient_postal, m.is_return, m."isReturn", m.driver_id, m.driver_name
  FROM (SELECT DISTINCT unnest(p_ids) AS id) i
  CROSS JOIN LATERAL (
    SELECT a.details FROM public.audit_log a
    WHERE a.tenant_id = p_tenant AND a.action = 'shipment_data' AND a.details->>'id' = i.id
    ORDER BY a.created_at DESC, a.id
    LIMIT 1
  ) latest
  CROSS JOIN LATERAL pg_catalog.jsonb_to_record(latest.details)
    AS m(recipient_country text, recipient_postal text, is_return jsonb, "isReturn" jsonb, driver_id text, driver_name text)
$$;

REVOKE ALL ON FUNCTION public.shipment_list_metadata(uuid, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shipment_list_metadata(uuid, text[]) TO service_role;
