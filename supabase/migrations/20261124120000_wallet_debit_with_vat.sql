-- Pay as you go: a wallet é carregada com dinheiro COM IVA (Stripe), mas cada envio descontava só o
-- sell_price (s/ IVA). Ex.: envio 3,39 € s/ IVA (4,17 € c/ IVA) descontava 3,39 €.
-- A partir desta migração cada reserva guarda a taxa de IVA do envio (vat_pct) e o consumo passa a ser
-- round(sell_price * (1 + vat_pct/100), 2) — também depois de acertos de peso, que alteram o sell_price.
-- Reservas antigas ficam com vat_pct NULL e continuam a consumir o valor s/ IVA: nenhum saldo existente muda.
BEGIN;
ALTER TABLE public.wallet_reservations ADD COLUMN IF NOT EXISTS vat_pct numeric(5,2)
  CHECK (vat_pct IS NULL OR (vat_pct >= 0 AND vat_pct <= 100));

CREATE OR REPLACE FUNCTION public.client_wallet_snapshot(p_tenant uuid,p_client uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE profile jsonb; spent numeric; held numeric; credit numeric; invalid_charges bigint; since timestamptz;
BEGIN
  PERFORM 1 FROM public.clients WHERE id=p_client AND tenant_id=p_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client not found in tenant'; END IF;
  SELECT details INTO profile FROM public.audit_log WHERE tenant_id=p_tenant AND action='client_data'
    AND details->>'id'=p_client::text ORDER BY created_at DESC,id DESC LIMIT 1;
  IF profile IS NULL OR profile->>'credit_limit' IS NULL THEN RAISE EXCEPTION 'Balance profile missing'; END IF;
  credit := (profile->>'credit_limit')::numeric;
  since := NULLIF(profile->>'pay_as_you_go_since','')::timestamptz;
  IF credit::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid balance'; END IF;
  WITH audit_shipments AS (
    SELECT DISTINCT ON (details->>'id') details->>'id' id,details->>'status' status,
      (details->>'sell_price')::numeric price,details->>'billing_type' billing_type,created_at
    FROM public.audit_log a WHERE tenant_id=p_tenant AND action='shipment_data' AND details->>'client_id'=p_client::text
    ORDER BY details->>'id',created_at DESC,a.id DESC
  ), client_reservations AS (
    SELECT r.shipment_id::text id,r.vat_pct FROM public.wallet_reservations r WHERE r.tenant_id=p_tenant AND r.client_id=p_client
  ), all_shipments AS (
    SELECT s.id::text,s.status::text,
      CASE WHEN r.vat_pct IS NOT NULL AND s.sell_price IS NOT NULL THEN round(s.sell_price*(100+r.vat_pct)/100,2) ELSE s.sell_price END price,
      CASE WHEN r.id IS NOT NULL THEN 'pay_as_you_go' ELSE (SELECT a.billing_type FROM audit_shipments a WHERE a.id=s.id::text) END billing_type
      FROM public.shipments s LEFT JOIN client_reservations r ON r.id=s.id::text
      WHERE s.tenant_id=p_tenant AND s.client_id=p_client AND (since IS NULL OR s.created_at>=since)
    UNION ALL
    SELECT a.id,a.status,
      CASE WHEN r.vat_pct IS NOT NULL AND a.price IS NOT NULL THEN round(a.price*(100+r.vat_pct)/100,2) ELSE a.price END,
      CASE WHEN r.id IS NOT NULL THEN 'pay_as_you_go' ELSE a.billing_type END
      FROM audit_shipments a LEFT JOIN client_reservations r ON r.id=a.id
      WHERE (since IS NULL OR a.created_at>=since) AND NOT EXISTS (
        SELECT 1 FROM public.shipments s WHERE s.id::text=a.id AND s.tenant_id=p_tenant AND s.client_id=p_client
      )
  ), charges AS (
    SELECT COALESCE(sum(price),0) spent,count(*) FILTER (WHERE price IS NULL OR price<0 OR price::text IN ('NaN','Infinity','-Infinity')) invalid
    FROM all_shipments WHERE lower(COALESCE(status,'')) NOT IN ('anulado','cancelado','cancelled','canceled')
      AND billing_type IS DISTINCT FROM 'conta_corrente'
  ), reservations AS (
    SELECT COALESCE(sum(r.amount),0) held FROM public.wallet_reservations r
      WHERE r.tenant_id=p_tenant AND r.client_id=p_client AND r.state<>'released'
        AND NOT EXISTS (SELECT 1 FROM all_shipments s WHERE s.id=r.shipment_id::text)
  ) SELECT c.spent,c.invalid,r.held INTO spent,invalid_charges,held FROM charges c CROSS JOIN reservations r;
  IF invalid_charges>0 THEN RAISE EXCEPTION 'Invalid shipment charges'; END IF;
  IF spent::text IN ('NaN','Infinity','-Infinity') OR held::text IN ('NaN','Infinity','-Infinity') OR spent<0 THEN
    RAISE EXCEPTION 'Invalid shipment charges';
  END IF;
  RETURN jsonb_build_object('credit',credit,'spent',spent,'reserved',held,'balance',credit-spent-held,
    'billing_type',profile->>'billing_type');
END $$;

-- p_amount = total s/ IVA (sell_price); p_vat_pct = taxa do envio (23 PT-CONT, 0 ilhas/internacional).
-- NULL mantém o comportamento antigo (consome s/ IVA). A reserva guarda o valor COM IVA.
CREATE OR REPLACE FUNCTION public.reserve_shipment_wallet(p_tenant uuid,p_client uuid,p_shipment uuid,p_amount numeric,p_reference text,p_vat_pct numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE snapshot jsonb; prior public.wallet_reservations; model text; gross numeric;
BEGIN
  PERFORM 1 FROM public.clients WHERE id=p_client AND tenant_id=p_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client not found in tenant'; END IF;
  IF p_amount IS NULL OR p_amount::text IN ('NaN','Infinity','-Infinity') OR p_amount<0 OR round(p_amount,2)<>p_amount THEN
    RAISE EXCEPTION 'Invalid reservation amount';
  END IF;
  IF p_vat_pct IS NOT NULL AND (p_vat_pct::text IN ('NaN','Infinity','-Infinity') OR p_vat_pct<0 OR p_vat_pct>100) THEN
    RAISE EXCEPTION 'Invalid VAT rate';
  END IF;
  gross := CASE WHEN p_vat_pct IS NULL THEN p_amount ELSE round(p_amount*(100+p_vat_pct)/100,2) END;
  SELECT * INTO prior FROM public.wallet_reservations WHERE shipment_id=p_shipment;
  IF FOUND THEN
    IF prior.client_id<>p_client OR prior.tenant_id<>p_tenant OR prior.amount<>gross OR prior.reference<>p_reference
      OR prior.vat_pct IS DISTINCT FROM p_vat_pct THEN
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
  IF (snapshot->>'balance')::numeric-gross < 0 THEN
    RETURN jsonb_build_object('reserved',false,'refused',true,'balance',snapshot->'balance','amount',gross);
  END IF;
  INSERT INTO public.wallet_reservations(shipment_id,tenant_id,client_id,amount,state,reference,vat_pct)
    VALUES(p_shipment,p_tenant,p_client,gross,'reserved',p_reference,p_vat_pct);
  RETURN jsonb_build_object('reserved',true,'balance',snapshot->'balance','amount',gross);
END $$;

-- Assinatura antiga (usada por materialize_shipment_quotation): cotações aceites aplicam o IVA da proposta
-- (has_iva → 23%, sem IVA → 0%); outras chamadas mantêm o comportamento antigo.
CREATE OR REPLACE FUNCTION public.reserve_shipment_wallet(p_tenant uuid,p_client uuid,p_shipment uuid,p_amount numeric,p_reference text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE vat numeric;
BEGIN
  SELECT CASE details->>'has_iva' WHEN 'true' THEN 23 WHEN 'false' THEN 0 END INTO vat FROM public.audit_log
    WHERE id=p_shipment AND tenant_id=p_tenant AND action='shipment_quote_request';
  RETURN public.reserve_shipment_wallet(p_tenant,p_client,p_shipment,p_amount,p_reference,vat);
END $$;

REVOKE ALL ON FUNCTION public.client_wallet_snapshot(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reserve_shipment_wallet(uuid,uuid,uuid,numeric,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reserve_shipment_wallet(uuid,uuid,uuid,numeric,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.client_wallet_snapshot(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_shipment_wallet(uuid,uuid,uuid,numeric,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_shipment_wallet(uuid,uuid,uuid,numeric,text,numeric) TO service_role;
COMMIT;
