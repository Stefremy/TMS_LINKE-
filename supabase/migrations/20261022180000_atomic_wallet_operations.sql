-- No historical payment is recredited and no existing balance is rewritten here.
BEGIN;
ALTER TABLE public.client_transactions ADD COLUMN IF NOT EXISTS credited_at timestamptz;
ALTER TABLE public.client_transactions ADD COLUMN IF NOT EXISTS stripe_event_id text;
-- All application access already goes through authenticated server actions/webhooks.
-- Browser roles must not be able to forge/reset the fulfillment marker or the binding.
ALTER TABLE public.client_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_transactions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.client_transactions TO service_role;

CREATE TABLE IF NOT EXISTS public.wallet_reservations (
  shipment_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  state text NOT NULL CHECK (state IN ('reserved','submitted','consumed','released')),
  reference text NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_profile_lookup ON public.audit_log(tenant_id,(details->>'id'),created_at DESC,id DESC) WHERE action='client_data';
CREATE INDEX IF NOT EXISTS wallet_shipment_audit_lookup ON public.audit_log(tenant_id,(details->>'client_id'),(details->>'id'),created_at DESC,id DESC) WHERE action='shipment_data';
CREATE INDEX IF NOT EXISTS wallet_shipment_scope ON public.shipments(tenant_id,client_id);
CREATE INDEX IF NOT EXISTS wallet_reservations_client ON public.wallet_reservations(tenant_id,client_id);
ALTER TABLE public.wallet_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wallet_reservations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.wallet_reservations TO service_role;

CREATE OR REPLACE FUNCTION public.settle_stripe_topup(
  p_transaction uuid, p_tenant uuid, p_client uuid, p_session text, p_cents bigint, p_event text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t public.client_transactions; profile public.audit_log; credit numeric;
BEGIN
  PERFORM 1 FROM public.clients WHERE id=p_client AND tenant_id=p_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client not found in tenant'; END IF;
  SELECT * INTO t FROM public.client_transactions WHERE id=p_transaction FOR UPDATE;
  IF NOT FOUND OR t.tenant_id<>p_tenant OR t.client_id<>p_client
    OR p_session IS NULL OR p_session='' OR t.stripe_session_id IS DISTINCT FROM p_session OR p_cents IS NULL OR p_cents<100
    OR t.amount*100<>p_cents OR p_event IS NULL OR p_event='' THEN
    RAISE EXCEPTION 'Payment binding mismatch';
  END IF;
  IF t.credited_at IS NOT NULL THEN RETURN 'already_credited'; END IF;
  -- Older paid rows have no reliable fulfillment marker. Reconcile explicitly, never replay them.
  IF t.status='paid' THEN RETURN 'legacy_reconciliation_required'; END IF;
  IF t.status NOT IN ('pending','failed') THEN RAISE EXCEPTION 'Unsupported payment state'; END IF;
  SELECT * INTO profile FROM public.audit_log WHERE tenant_id=p_tenant AND action='client_data'
    AND details->>'id'=p_client::text ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR profile.details->>'credit_limit' IS NULL THEN RAISE EXCEPTION 'Balance profile missing'; END IF;
  credit := (profile.details->>'credit_limit')::numeric;
  IF credit::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid balance'; END IF;
  UPDATE public.audit_log SET details=jsonb_set(details,'{credit_limit}',to_jsonb(credit+t.amount)) WHERE id=profile.id;
  UPDATE public.client_transactions SET status='paid',credited_at=now(),stripe_event_id=p_event,updated_at=now() WHERE id=t.id;
  RETURN 'credited';
END $$;

-- Canonical shipment totals (sell_price already includes fuel and extras). Native rows win;
-- a recovered audit-only shipment still consumes funds. Receipt status never changes consumption.
CREATE OR REPLACE FUNCTION public.client_wallet_snapshot(p_tenant uuid,p_client uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE profile jsonb; spent numeric; held numeric; credit numeric; invalid_charges bigint;
BEGIN
  PERFORM 1 FROM public.clients WHERE id=p_client AND tenant_id=p_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client not found in tenant'; END IF;
  SELECT details INTO profile FROM public.audit_log WHERE tenant_id=p_tenant AND action='client_data'
    AND details->>'id'=p_client::text ORDER BY created_at DESC,id DESC LIMIT 1;
  IF profile IS NULL OR profile->>'credit_limit' IS NULL THEN RAISE EXCEPTION 'Balance profile missing'; END IF;
  credit := (profile->>'credit_limit')::numeric;
  IF credit::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid balance'; END IF;
  WITH audit_shipments AS (
    SELECT DISTINCT ON (details->>'id') details->>'id' id,details->>'status' status,
      (details->>'sell_price')::numeric price,details->>'billing_type' billing_type
    FROM public.audit_log a WHERE tenant_id=p_tenant AND action='shipment_data' AND details->>'client_id'=p_client::text
    ORDER BY details->>'id',created_at DESC,a.id DESC
  ), all_shipments AS (
    SELECT s.id::text,s.status::text,s.sell_price price,
      CASE WHEN EXISTS (SELECT 1 FROM public.wallet_reservations r WHERE r.shipment_id=s.id AND r.tenant_id=p_tenant AND r.client_id=p_client)
        THEN 'pay_as_you_go' ELSE (SELECT a.billing_type FROM audit_shipments a WHERE a.id=s.id::text) END billing_type
      FROM public.shipments s WHERE tenant_id=p_tenant AND client_id=p_client
    UNION ALL
    SELECT a.id,a.status,a.price,CASE WHEN EXISTS (
      SELECT 1 FROM public.wallet_reservations r WHERE r.shipment_id::text=a.id AND r.tenant_id=p_tenant AND r.client_id=p_client
    ) THEN 'pay_as_you_go' ELSE a.billing_type END FROM audit_shipments a WHERE NOT EXISTS (
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
  -- Consumption and reservations above share ONE MVCC snapshot: an in-flight shipment insert
  -- cannot disappear between separate spent/held queries while the next request reserves credit.
  IF invalid_charges>0 THEN RAISE EXCEPTION 'Invalid shipment charges'; END IF;
  IF spent::text IN ('NaN','Infinity','-Infinity') OR held::text IN ('NaN','Infinity','-Infinity') OR spent<0 THEN
    RAISE EXCEPTION 'Invalid shipment charges';
  END IF;
  RETURN jsonb_build_object('credit',credit,'spent',spent,'reserved',held,'balance',credit-spent-held,
    'billing_type',profile->>'billing_type');
END $$;

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
  IF (snapshot->>'balance')::numeric-p_amount < -2 THEN
    RETURN jsonb_build_object('reserved',false,'refused',true,'balance',snapshot->'balance');
  END IF;
  INSERT INTO public.wallet_reservations(shipment_id,tenant_id,client_id,amount,state,reference)
    VALUES(p_shipment,p_tenant,p_client,p_amount,'reserved',p_reference);
  RETURN jsonb_build_object('reserved',true,'balance',snapshot->'balance');
END $$;

CREATE OR REPLACE FUNCTION public.transition_wallet_reservation(p_tenant uuid,p_client uuid,p_shipment uuid,p_from text,p_to text,p_result jsonb DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.clients WHERE id=p_client AND tenant_id=p_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client not found in tenant'; END IF;
  IF NOT ((p_from='reserved' AND p_to IN ('submitted','consumed','released'))
    OR (p_from='submitted' AND p_to IN ('consumed','released'))) THEN RAISE EXCEPTION 'Invalid transition'; END IF;
  UPDATE public.wallet_reservations SET state=p_to,result=p_result,updated_at=now()
    WHERE shipment_id=p_shipment AND tenant_id=p_tenant AND client_id=p_client AND state=p_from;
  RETURN FOUND;
END $$;

-- Saving a profile must not overwrite a top-up that committed while its form was being saved.
CREATE OR REPLACE FUNCTION public.save_client_financial_profile(p_tenant uuid,p_client uuid,p_details jsonb,p_expected_credit numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE prior public.audit_log; new_id uuid;
BEGIN
  PERFORM 1 FROM public.clients WHERE id=p_client AND tenant_id=p_tenant FOR UPDATE;
  IF NOT FOUND OR p_details->>'id' IS DISTINCT FROM p_client::text THEN RAISE EXCEPTION 'Client binding mismatch'; END IF;
  SELECT * INTO prior FROM public.audit_log WHERE tenant_id=p_tenant AND action='client_data'
    AND details->>'id'=p_client::text ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
  IF (prior.details->>'credit_limit')::numeric IS DISTINCT FROM p_expected_credit THEN
    RAISE EXCEPTION 'Balance changed; refresh the client before saving';
  END IF;
  IF (p_details->>'credit_limit') IS NULL OR (p_details->>'credit_limit')::numeric::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'Invalid credit';
  END IF;
  INSERT INTO public.audit_log(tenant_id,action,details) VALUES(p_tenant,'client_data',p_details) RETURNING id INTO new_id;
  DELETE FROM public.audit_log WHERE tenant_id=p_tenant AND action='client_data' AND details->>'id'=p_client::text
    AND id<>new_id;
END $$;

REVOKE ALL ON FUNCTION public.settle_stripe_topup(uuid,uuid,uuid,text,bigint,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.client_wallet_snapshot(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reserve_shipment_wallet(uuid,uuid,uuid,numeric,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.transition_wallet_reservation(uuid,uuid,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.save_client_financial_profile(uuid,uuid,jsonb,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_stripe_topup(uuid,uuid,uuid,text,bigint,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.client_wallet_snapshot(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_shipment_wallet(uuid,uuid,uuid,numeric,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_wallet_reservation(uuid,uuid,uuid,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_client_financial_profile(uuid,uuid,jsonb,numeric) TO service_role;
COMMIT;
