-- Limpeza de testes: elimina um extrato/fatura de TESTE e os seus envios numa única transação, para que
-- deixem de contar em receitas, margens e estatísticas de faturação.
-- Recusa faturas emitidas no Moloni de produção (essas anulam-se no Moloni, com nota de crédito) e
-- extratos com notas de crédito. Deixa um registo de eliminação por envio e um pelo extrato.
-- A autorização (quem pode eliminar) é verificada no servidor antes da chamada; só o service_role executa.
BEGIN;
CREATE OR REPLACE FUNCTION public.delete_test_billing_statement(p_tenant uuid,p_statement_number text,p_actor text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE st public.audit_log; num text; client uuid; ids uuid[]; deleted int;
BEGIN
  IF p_statement_number IS NULL OR btrim(p_statement_number)='' THEN RAISE EXCEPTION 'Extrato inválido.'; END IF;
  SELECT * INTO st FROM public.audit_log WHERE tenant_id=p_tenant AND action='billing_statement'
    AND details->>'statement_number'=p_statement_number ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Extrato não encontrado.'; END IF;
  num := st.details->>'statement_number';
  client := NULLIF(st.details->>'client_id','')::uuid;
  IF client IS NULL THEN RAISE EXCEPTION 'Extrato sem cliente associado.'; END IF;
  IF COALESCE(st.details->>'moloni_document_id','')<>'' AND st.details->>'moloni_environment' IS DISTINCT FROM 'test' THEN
    RAISE EXCEPTION 'Esta fatura foi emitida no Moloni de produção. Anule-a no Moloni (nota de crédito); não pode ser eliminada no TMS.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.audit_log WHERE tenant_id=p_tenant AND action='credit_note'
      AND details->'source'->>'id' IN (st.id::text, st.details->>'id')) THEN
    RAISE EXCEPTION 'Este extrato tem notas de crédito associadas e não pode ser eliminado.';
  END IF;

  -- Envios do extrato: os listados nele e os ligados à linha de faturação, só deste cliente.
  SELECT COALESCE(array_agg(DISTINCT s.id),'{}') INTO ids FROM public.shipments s
    WHERE s.tenant_id=p_tenant AND s.client_id=client AND (
      s.id::text IN (SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(st.details->'shipment_ids')='array' THEN st.details->'shipment_ids' ELSE '[]'::jsonb END))
      OR s.billing_statement_id IN (SELECT b.id FROM public.billing_statements b WHERE b.tenant_id=p_tenant AND b.statement_number=num));

  INSERT INTO public.audit_log(tenant_id,action,details)
  SELECT p_tenant,'shipment_hard_deleted',jsonb_build_object('deletedShipmentId',s.id,'trackingNumber',s.tracking_number,
    'previousStatus',s.status,'reason','Limpeza de teste: '||num,'deletedBy',p_actor,'deletedAt',now())
  FROM public.shipments s WHERE s.id=ANY(ids);

  DELETE FROM public.billing_emission_claims WHERE shipment_id=ANY(ids);
  DELETE FROM public.wallet_reservations WHERE shipment_id=ANY(ids);
  DELETE FROM public.credit_limit_reservations WHERE shipment_id=ANY(ids);
  DELETE FROM public.shipments WHERE tenant_id=p_tenant AND id=ANY(ids);
  GET DIAGNOSTICS deleted = ROW_COUNT;
  DELETE FROM public.billing_statements WHERE tenant_id=p_tenant AND statement_number=num;
  DELETE FROM public.audit_log WHERE tenant_id=p_tenant AND (
    id=st.id
    OR (action='billing_invoice_email_sent' AND details->>'statement_number'=num)
    OR (action IN ('shipment_data','tracking_email_sent','shipment_carrier_measurements','shipment_weight_adjustment')
      AND COALESCE(details->>'id',details->>'shipment_id') = ANY(ids::text[])));

  INSERT INTO public.audit_log(tenant_id,action,details) VALUES(p_tenant,'billing_statement_test_deleted',jsonb_build_object(
    'statement_number',num,'client_id',client,'moloni_document_number',st.details->>'moloni_document_number',
    'moloni_environment',st.details->>'moloni_environment','total_value',st.details->'total_value',
    'shipments_deleted',deleted,'deletedBy',p_actor,'deletedAt',now()));
  RETURN jsonb_build_object('statement_number',num,'shipments_deleted',deleted);
END $$;
REVOKE ALL ON FUNCTION public.delete_test_billing_statement(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.delete_test_billing_statement(uuid,text,text) TO service_role;
COMMIT;
