-- Code must be deployed before enabling CARRIER_WEIGHT_REPRICING_ENABLED.
-- No historical shipment, balance, invoice or carrier record is changed by this migration.
BEGIN;
CREATE INDEX IF NOT EXISTS shipment_weight_adjustment_lookup ON public.audit_log(tenant_id,(details->>'shipment_id'),created_at DESC) WHERE action='shipment_weight_adjustment';
CREATE OR REPLACE FUNCTION public.apply_carrier_weight_adjustment(
  p_tenant uuid,p_client uuid,p_shipment uuid,p_snapshot uuid,p_measurement uuid,
  p_expected_price numeric,p_expected_buy numeric,p_plan jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.shipments; snapshot public.audit_log; measured public.audit_log; next_price numeric;
  next_buy numeric; next_base numeric; next_fuel numeric; delta numeric; old_weight numeric; new_weight numeric; k text; amount numeric; next_details jsonb;
BEGIN
  -- Same lock as recurring statement reservations and invoice claims.
  PERFORM pg_advisory_xact_lock(hashtextextended('period:'||p_tenant::text||':'||p_client::text,0));
  -- Same row lock as wallet top-ups/reservations; an adjustment consumes the native
  -- shipment total, never a second decrement of the client's credit_limit.
  PERFORM 1 FROM public.clients WHERE tenant_id=p_tenant AND id=p_client FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid client scope'; END IF;
  SELECT * INTO s FROM public.shipments WHERE tenant_id=p_tenant AND client_id=p_client AND id=p_shipment FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid shipment scope'; END IF;
  IF s.sell_price IS DISTINCT FROM p_expected_price OR s.buy_price IS DISTINCT FROM p_expected_buy THEN RETURN '{"status":"unchanged"}'; END IF;
  IF COALESCE(to_jsonb(s)->>'billing_statement_id','')<>'' OR lower(s.status::text) IN ('rascunho','draft','anulado','cancelado','cancelled','canceled')
    OR EXISTS(SELECT 1 FROM public.billing_emission_claims c WHERE c.tenant_id=p_tenant AND c.shipment_id=p_shipment)
    OR EXISTS(SELECT 1 FROM public.audit_log a WHERE a.tenant_id=p_tenant AND a.action IN ('billing_statement','period_statement')
      AND (COALESCE(a.details->'shipment_ids','[]'::jsonb)?p_shipment::text
        OR EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a.details->'shipments')='array' THEN a.details->'shipments' ELSE '[]'::jsonb END) item WHERE item->>'id'=p_shipment::text)))
    THEN RETURN '{"status":"locked"}'; END IF;
  SELECT * INTO snapshot FROM public.audit_log WHERE tenant_id=p_tenant AND action='shipment_data' AND details->>'id'=p_shipment::text
    ORDER BY created_at DESC,id DESC LIMIT 1;
  SELECT * INTO measured FROM public.audit_log WHERE tenant_id=p_tenant AND action='shipment_carrier_measurements' AND details->>'shipment_id'=p_shipment::text
    ORDER BY created_at DESC,id DESC LIMIT 1;
  IF snapshot.id IS DISTINCT FROM p_snapshot OR measured.id IS DISTINCT FROM p_measurement THEN RETURN '{"status":"unchanged"}'; END IF;
  IF snapshot.details->>'client_id' IS DISTINCT FROM p_client::text OR snapshot.details->'weight_pricing_basis' IS NULL
    OR measured.details->>'carrier' IS DISTINCT FROM s.carrier_code THEN RAISE EXCEPTION 'Invalid pricing evidence'; END IF;
  FOREACH k IN ARRAY ARRAY['price','buyPrice','basePrice','fuelAmount','previousPrice','difference'] LOOP
    IF jsonb_typeof(p_plan->k) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Invalid adjustment amount'; END IF;
    amount:=(p_plan->>k)::numeric;
    IF amount::text IN ('NaN','Infinity','-Infinity') OR amount<0 OR amount<>round(amount,2) OR amount>999999999 THEN RAISE EXCEPTION 'Invalid adjustment amount'; END IF;
  END LOOP;
  old_weight:=COALESCE(snapshot.details->>'billing_weight_kg',snapshot.details->>'weight_kg')::numeric;
  new_weight:=(p_plan->>'weightKg')::numeric;
  IF old_weight IS NULL OR old_weight<=0 OR old_weight::text IN ('NaN','Infinity','-Infinity') OR new_weight IS NULL OR new_weight::text IN ('NaN','Infinity','-Infinity') OR new_weight<=old_weight
    OR (p_plan->>'previousWeightKg')::numeric IS DISTINCT FROM old_weight THEN RAISE EXCEPTION 'Invalid billing weight'; END IF;
  next_price:=(p_plan->>'price')::numeric; next_buy:=(p_plan->>'buyPrice')::numeric;
  next_base:=(p_plan->>'basePrice')::numeric; next_fuel:=(p_plan->>'fuelAmount')::numeric;
  delta:=next_price-s.sell_price;
  IF delta<=0 OR delta IS DISTINCT FROM (p_plan->>'difference')::numeric OR (p_plan->>'previousPrice')::numeric IS DISTINCT FROM s.sell_price
    OR next_base+next_fuel+COALESCE((snapshot.details->>'special_fees_amount')::numeric,0)<>next_price THEN RAISE EXCEPTION 'Adjustment total mismatch'; END IF;
  next_details:=snapshot.details||jsonb_build_object('sell_price',next_price,'buy_price',next_buy,'base_price',next_base,
    'fuel_tax_amount',next_fuel,'fuel_rate_pct',p_plan->'fuelRatePct','billing_weight_kg',new_weight,
    'tier_label',p_plan->>'tier','weight_adjusted_at',clock_timestamp());
  -- Keep weight_kg and packages unchanged: these are the original client declaration.
  UPDATE public.shipments SET sell_price=next_price,buy_price=next_buy WHERE tenant_id=p_tenant AND id=p_shipment;
  INSERT INTO public.audit_log(tenant_id,action,details,created_at) VALUES(p_tenant,'shipment_data',next_details,clock_timestamp());
  INSERT INTO public.audit_log(tenant_id,action,details,created_at) VALUES(p_tenant,'shipment_weight_adjustment',
    p_plan||jsonb_build_object('shipment_id',p_shipment,'client_id',p_client,'measurement_id',p_measurement,
      'carrier',measured.details->>'carrier','reason','carrier_weight_tier','applied_at',clock_timestamp()),clock_timestamp());
  RETURN jsonb_build_object('status','adjusted','price',next_price,'difference',delta);
END $$;
REVOKE ALL ON FUNCTION public.apply_carrier_weight_adjustment(uuid,uuid,uuid,uuid,uuid,numeric,numeric,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_carrier_weight_adjustment(uuid,uuid,uuid,uuid,uuid,numeric,numeric,jsonb) TO service_role;

-- A manual invoice may have loaded its prices before the automatic correction.
-- Claim and validate those exact prices in one transaction before contacting Moloni.
CREATE OR REPLACE FUNCTION public.claim_weight_safe_billing_shipments(p_tenant uuid,p_client uuid,p_emission uuid,p_expected jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ids uuid[];
BEGIN
  IF jsonb_typeof(p_expected) IS DISTINCT FROM 'array' OR jsonb_array_length(p_expected)=0 THEN RAISE EXCEPTION 'Missing invoice prices'; END IF;
  SELECT array_agg((item->>'id')::uuid) INTO ids FROM jsonb_array_elements(p_expected) item;
  PERFORM public.claim_billing_shipments(p_tenant,p_client,p_emission,ids);
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_expected) item LEFT JOIN public.shipments s
    ON s.id=(item->>'id')::uuid AND s.tenant_id=p_tenant AND s.client_id=p_client
    WHERE jsonb_typeof(item->'price') IS DISTINCT FROM 'number' OR s.sell_price IS DISTINCT FROM (item->>'price')::numeric)
    THEN RAISE EXCEPTION 'Shipment prices changed. Refresh before issuing.'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.claim_weight_safe_billing_shipments(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_weight_safe_billing_shipments(uuid,uuid,uuid,jsonb) TO service_role;
COMMIT;
