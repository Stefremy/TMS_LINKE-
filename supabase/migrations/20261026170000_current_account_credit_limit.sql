-- Explicit opt-in for Conta Corrente. No existing client or monetary rows are changed.
BEGIN;
CREATE TABLE IF NOT EXISTS public.credit_limit_reservations (
  shipment_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  amount numeric NOT NULL CHECK (amount >= 0 AND amount::text NOT IN ('NaN','Infinity','-Infinity')),
  reference text NOT NULL,
  state text NOT NULL CHECK (state IN ('reserved','submitted','consumed','released')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_limit_reservations_client_idx ON public.credit_limit_reservations(tenant_id,client_id);
ALTER TABLE public.credit_limit_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.credit_limit_reservations FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.credit_limit_reservations TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_current_account_credit(p_tenant uuid,p_client uuid,p_shipment uuid,p_amount numeric,p_reference text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE profile jsonb; credit numeric; debt numeric; held numeric; invalid bigint;
BEGIN
  -- Profile saves and concurrent reservations share this client-row lock.
  PERFORM 1 FROM public.clients WHERE id=p_client AND tenant_id=p_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client not found in tenant'; END IF;
  IF p_amount IS NULL OR p_amount<0 OR p_amount::text IN ('NaN','Infinity','-Infinity') OR round(p_amount,2)<>p_amount
    OR p_reference IS NULL THEN RAISE EXCEPTION 'Invalid reservation amount or reference'; END IF;
  SELECT details INTO profile FROM public.audit_log WHERE tenant_id=p_tenant AND action='client_data'
    AND details->>'id'=p_client::text ORDER BY created_at DESC,id DESC LIMIT 1;
  IF profile IS NULL THEN RAISE EXCEPTION 'Credit profile missing'; END IF;
  IF profile->>'billing_type'='pay_as_you_go' THEN RAISE EXCEPTION 'Billing model changed; refresh client'; END IF;
  IF profile->>'credit_limit_enabled' IS DISTINCT FROM 'true' THEN RETURN jsonb_build_object('reserved',false); END IF;
  credit := (profile->>'credit_limit')::numeric;
  IF credit IS NULL OR credit<0 OR credit::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid credit limit'; END IF;
  IF EXISTS (SELECT 1 FROM public.credit_limit_reservations WHERE shipment_id=p_shipment) THEN
    RAISE EXCEPTION 'Shipment request already reserved; confirm its outcome';
  END IF;

  -- One MVCC snapshot for persisted charges and unmatched reservations avoids double counting
  -- when another request finishes persisting its shipment while this query runs.
  WITH audit_shipments AS (
    SELECT DISTINCT ON (details->>'id') details->>'id' id,details
    FROM public.audit_log a WHERE tenant_id=p_tenant AND action='shipment_data' AND details->>'client_id'=p_client::text
    ORDER BY details->>'id',created_at DESC,a.id DESC
  ), all_shipments AS (
    SELECT s.id::text id,s.status::text status,s.sell_price price,
      COALESCE(NULLIF(to_jsonb(s)->>'billing_statement_id',''),
        (SELECT a.details->>'billing_statement_id' FROM audit_shipments a WHERE a.id=s.id::text)) statement_id
      FROM public.shipments s WHERE tenant_id=p_tenant AND client_id=p_client
    UNION ALL
    SELECT a.id,a.details->>'status',(a.details->>'sell_price')::numeric,a.details->>'billing_statement_id'
      FROM audit_shipments a WHERE NOT EXISTS (
        SELECT 1 FROM public.shipments s WHERE s.id::text=a.id AND s.tenant_id=p_tenant AND s.client_id=p_client
      )
  ), statements AS (
    SELECT DISTINCT ON (COALESCE(details->>'id',id::text)) details
    FROM public.audit_log WHERE tenant_id=p_tenant AND action='billing_statement' AND details->>'client_id'=p_client::text
    ORDER BY COALESCE(details->>'id',id::text),created_at DESC,id DESC
  ), charges AS (
    SELECT price FROM all_shipments WHERE (NULLIF(statement_id,'') IS NULL
      OR NOT EXISTS (SELECT 1 FROM statements b WHERE b.details->>'id'=statement_id))
      AND lower(COALESCE(status,'')) NOT IN ('anulado','cancelado','cancelled','canceled')
    UNION ALL
    SELECT COALESCE((details->>'outstanding_value')::numeric,(details->>'total_value')::numeric,0)
      FROM statements WHERE COALESCE(details->>'status','')<>'paid'
        AND NULLIF(details->>'moloni_receipt_id','') IS NULL AND NULLIF(details->>'moloni_receipt_pdf','') IS NULL
        AND (NULLIF(details->>'moloni_document_id','') IS NOT NULL OR NOT COALESCE((details->>'is_pro_forma')::boolean,false))
  ), reservations AS (
    SELECT COALESCE(sum(r.amount),0) amount FROM public.credit_limit_reservations r
    WHERE r.tenant_id=p_tenant AND r.client_id=p_client AND r.state<>'released'
      AND NOT EXISTS (SELECT 1 FROM all_shipments s WHERE s.id=r.shipment_id::text)
  ) SELECT COALESCE(sum(c.price),0),count(*) FILTER (WHERE c.price IS NULL OR c.price<0 OR c.price::text IN ('NaN','Infinity','-Infinity')),
      (SELECT amount FROM reservations) INTO debt,invalid,held FROM charges c;
  IF invalid>0 THEN RAISE EXCEPTION 'Invalid account charges'; END IF;
  IF debt+held+p_amount>credit THEN
    RETURN jsonb_build_object('reserved',false,'refused',true,'balance',credit-debt-held);
  END IF;
  INSERT INTO public.credit_limit_reservations(shipment_id,tenant_id,client_id,amount,reference,state)
    VALUES(p_shipment,p_tenant,p_client,p_amount,p_reference,'reserved');
  RETURN jsonb_build_object('reserved',true,'balance',credit-debt-held);
END $$;

CREATE OR REPLACE FUNCTION public.transition_credit_limit_reservation(p_tenant uuid,p_client uuid,p_shipment uuid,p_from text,p_to text,p_result jsonb DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM 1 FROM public.clients WHERE id=p_client AND tenant_id=p_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client not found in tenant'; END IF;
  IF NOT ((p_from='reserved' AND p_to IN ('submitted','consumed','released'))
    OR (p_from='submitted' AND p_to IN ('consumed','released'))) THEN RAISE EXCEPTION 'Invalid transition'; END IF;
  UPDATE public.credit_limit_reservations SET state=p_to,result=p_result,updated_at=now()
    WHERE shipment_id=p_shipment AND tenant_id=p_tenant AND client_id=p_client AND state=p_from;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.reserve_current_account_credit(uuid,uuid,uuid,numeric,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.transition_credit_limit_reservation(uuid,uuid,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_current_account_credit(uuid,uuid,uuid,numeric,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_credit_limit_reservation(uuid,uuid,uuid,text,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
