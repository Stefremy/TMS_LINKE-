-- Wallet (pay as you go) sem descoberto: um envio só é aceite se o saldo não ficar negativo (antes: até -2,00€).
-- Só muda o limite na reserva de saldo; saldos, reservas e permissões ficam iguais.
BEGIN;
CREATE OR REPLACE FUNCTION public.reserve_shipment_wallet(p_tenant uuid,p_client uuid,p_shipment uuid,p_amount numeric,p_reference text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE snapshot jsonb; prior public.wallet_reservations; model text;
BEGIN
  PERFORM 1 FROM public.clients WHERE id=p_client AND tenant_id=p_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client not found in tenant'; END IF;
  IF p_amount IS NULL OR p_amount::text IN ('NaN','Infinity','-Infinity') OR p_amount<0 OR round(p_amount,2)<>p_amount THEN
    RAISE EXCEPTION 'Invalid reservation amount';
  END IF;
  SELECT * INTO prior FROM public.wallet_reservations WHERE shipment_id=p_shipment;
  IF FOUND THEN
    IF prior.client_id<>p_client OR prior.tenant_id<>p_tenant OR prior.amount<>p_amount OR prior.reference<>p_reference THEN
      RAISE EXCEPTION 'Reservation binding mismatch';
    END IF;
    RAISE EXCEPTION 'Shipment request already reserved; confirm its outcome';
  END IF;
  SELECT details->>'billing_type' INTO model FROM public.audit_log WHERE tenant_id=p_tenant AND action='client_data'
    AND details->>'id'=p_client::text ORDER BY created_at DESC,id DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Balance profile missing'; END IF;
  IF model IS DISTINCT FROM 'pay_as_you_go' THEN RETURN jsonb_build_object('reserved',false); END IF;
  snapshot := public.client_wallet_snapshot(p_tenant,p_client);
  IF snapshot->>'billing_type' IS DISTINCT FROM 'pay_as_you_go' THEN RETURN jsonb_build_object('reserved',false); END IF;
  IF (snapshot->>'balance')::numeric-p_amount < 0 THEN
    RETURN jsonb_build_object('reserved',false,'refused',true,'balance',snapshot->'balance');
  END IF;
  INSERT INTO public.wallet_reservations(shipment_id,tenant_id,client_id,amount,state,reference)
    VALUES(p_shipment,p_tenant,p_client,p_amount,'reserved',p_reference);
  RETURN jsonb_build_object('reserved',true,'balance',snapshot->'balance');
END $$;

REVOKE ALL ON FUNCTION public.reserve_shipment_wallet(uuid,uuid,uuid,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_shipment_wallet(uuid,uuid,uuid,numeric,text) TO service_role;
COMMIT;
