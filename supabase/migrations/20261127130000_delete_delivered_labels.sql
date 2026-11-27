-- Delivered shipments are never reprinted: delete their label PDFs/ZPL as soon as the status
-- becomes 'entregue'. Acceptance certificates and all other shipment data are kept. Irreversible.
CREATE OR REPLACE FUNCTION public.strip_label_data(p jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
DECLARE r jsonb;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN RETURN p; END IF;
  r := p - ARRAY['ctt_label_base64','carrier_label_base64','labelBase64','label_base64','carrier_labels'];
  IF jsonb_typeof(r->'ctt_documents') = 'array' THEN
    r := jsonb_set(r, '{ctt_documents}', COALESCE((SELECT jsonb_agg(d) FROM jsonb_array_elements(r->'ctt_documents') d
      WHERE d->>'FileName' ~* '(aceita|acceptance)'), '[]'::jsonb));
  END IF;
  IF jsonb_typeof(r#>'{rawResponse,ShipmentData}') = 'array' THEN
    r := jsonb_set(r, '{rawResponse,ShipmentData}', COALESCE((SELECT jsonb_agg(
      CASE WHEN jsonb_typeof(s) = 'object' THEN s - ARRAY['LabelList','DocumentsList'] ELSE s END)
      FROM jsonb_array_elements(r#>'{rawResponse,ShipmentData}') s), '[]'::jsonb));
  END IF;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.purge_shipment_labels(p_tenant uuid, p_shipment uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.audit_log SET details = public.strip_label_data(details)
    WHERE tenant_id = p_tenant AND action = 'shipment_data' AND details->>'id' = p_shipment::text
      AND details ?| ARRAY['ctt_label_base64','carrier_label_base64','labelBase64','label_base64','carrier_labels','ctt_documents','rawResponse'];
  -- The wallet keeps a second copy of the emission result.
  IF to_regclass('public.wallet_reservations') IS NOT NULL THEN
    UPDATE public.wallet_reservations SET result = public.strip_label_data(result)
      WHERE tenant_id = p_tenant AND shipment_id = p_shipment AND result IS NOT NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.purge_delivered_shipment_labels()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- A cleanup problem must never block a delivery status update.
  BEGIN
    PERFORM public.purge_shipment_labels(NEW.tenant_id, NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Label cleanup failed for shipment %: %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.purge_shipment_labels(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_delivered_shipment_labels() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_shipment_labels(uuid, uuid) TO service_role;

DROP TRIGGER IF EXISTS shipments_delete_delivered_labels ON public.shipments;
CREATE TRIGGER shipments_delete_delivered_labels
  AFTER INSERT OR UPDATE OF status ON public.shipments
  FOR EACH ROW WHEN (NEW.status = 'entregue')
  EXECUTE FUNCTION public.purge_delivered_shipment_labels();
