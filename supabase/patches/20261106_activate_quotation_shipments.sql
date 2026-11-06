-- ACTIVATION: shipment quotations and manual partner tracking.
-- Supabase SQL Editor: run the complete file on the TMS project.
-- Definitions and additive schema only; existing quotes, shipments and balances are retained.
-- One transaction: any error rolls back the complete activation.
BEGIN;
-- SOURCE: 20260921100000_client_transactions.sql
-- Transações de clientes (Carregamentos de saldo)
CREATE TABLE IF NOT EXISTS public.client_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, failed
    stripe_session_id TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SOURCE: 20261022180000_atomic_wallet_operations.sql
-- No historical payment is recredited and no existing balance is rewritten here.
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
  ), all_shipments AS (
    SELECT s.id::text,s.status::text,s.sell_price price,
      CASE WHEN EXISTS (SELECT 1 FROM public.wallet_reservations r WHERE r.shipment_id=s.id AND r.tenant_id=p_tenant AND r.client_id=p_client)
        THEN 'pay_as_you_go' ELSE (SELECT a.billing_type FROM audit_shipments a WHERE a.id=s.id::text) END billing_type
      FROM public.shipments s WHERE tenant_id=p_tenant AND client_id=p_client AND (since IS NULL OR s.created_at>=since)
    UNION ALL
    SELECT a.id,a.status,a.price,CASE WHEN EXISTS (
      SELECT 1 FROM public.wallet_reservations r WHERE r.shipment_id::text=a.id AND r.tenant_id=p_tenant AND r.client_id=p_client
    ) THEN 'pay_as_you_go' ELSE a.billing_type END FROM audit_shipments a WHERE (since IS NULL OR a.created_at>=since) AND NOT EXISTS (
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

-- SOURCE: 20261026170000_current_account_credit_limit.sql
-- Explicit opt-in for Conta Corrente. No existing client or monetary rows are changed.
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

-- SOURCE: 20261105190000_quotation_shipments.sql
-- Accepting a quotation creates a zero-charge draft. Linke books it through its
-- own partner account; only recording that booking makes the shipment billable.
-- No existing quotation, shipment, client profile or price table is changed.
CREATE OR REPLACE FUNCTION public.materialize_shipment_quotation(
  p_tenant uuid, p_quote uuid, p_revision integer, p_actor uuid,
  p_client uuid, p_action text, p_tracking text DEFAULT NULL,
  p_buy_price numeric DEFAULT NULL, p_response text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  q jsonb; s jsonb; profile jsonb; snapshot jsonb; next_quote jsonb;
  quote_client uuid; snapshot_id uuid; shipment public.shipments%ROWTYPE;
  amount numeric; reservation jsonb; prepaid boolean; credit_hold boolean := false;
  stamp timestamptz := now();
BEGIN
  IF p_actor IS NULL OR p_revision IS NULL OR p_revision<0 OR p_action IS NULL OR p_action NOT IN ('accept','complete') THEN
    RAISE EXCEPTION 'Pedido de envio inválido.';
  END IF;
  SELECT a.details INTO q FROM public.audit_log a
    WHERE a.id=p_quote AND a.tenant_id=p_tenant AND a.action='shipment_quote_request' FOR UPDATE;
  IF q IS NULL OR q->>'id' IS DISTINCT FROM p_quote::text
    OR (p_client IS NOT NULL AND q->>'client_id' IS DISTINCT FROM p_client::text) THEN
    RAISE EXCEPTION 'Cotação indisponível ou sem acesso.';
  END IF;
  IF (q->>'revision')::integer IS DISTINCT FROM p_revision THEN
    RAISE EXCEPTION 'Esta cotação foi atualizada. Atualize a lista antes de continuar.';
  END IF;
  IF (p_action='accept' AND (p_client IS NULL OR q->>'status' IS DISTINCT FROM 'quoted'))
    OR (p_action='complete' AND (p_client IS NOT NULL OR q->>'status' IS DISTINCT FROM 'accepted')) THEN
    RAISE EXCEPTION 'Esta alteração já não é possível no estado atual da cotação.';
  END IF;
  quote_client := (q->>'client_id')::uuid;
  PERFORM 1 FROM public.clients c WHERE c.id=quote_client AND c.tenant_id=p_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente indisponível.'; END IF;
  SELECT a.details INTO profile FROM public.audit_log a WHERE a.tenant_id=p_tenant
    AND a.action='client_data' AND a.details->>'id'=quote_client::text ORDER BY a.created_at DESC,a.id DESC LIMIT 1;
  IF profile IS NULL OR profile->>'is_active'='false'
    OR EXISTS(SELECT 1 FROM public.audit_log a WHERE a.tenant_id=p_tenant AND a.action='deleted_client' AND a.details->>'id'=quote_client::text) THEN
    RAISE EXCEPTION 'Não foi possível validar a conta do cliente.';
  END IF;
  IF profile->>'billing_type' IS NULL OR profile->>'billing_type' NOT IN ('conta_corrente','pay_as_you_go') THEN
    RAISE EXCEPTION 'Confirme as condições de faturação do cliente.';
  END IF;
  amount := (q->>'proposed_price')::numeric;
  IF amount IS NULL OR amount<=0 OR amount>1000000 OR amount::text IN ('NaN','Infinity','-Infinity') OR round(amount,2)<>amount THEN
    RAISE EXCEPTION 'A cotação não tem um preço válido.';
  END IF;
  s := q->'shipment';
  IF s->>'recipientCountry' IS NULL OR s->>'recipientCountry' IN ('PT','ES') THEN
    RAISE EXCEPTION 'Este envio não pertence ao fluxo internacional por cotação.';
  END IF;
  IF p_action='complete' AND (p_tracking IS NULL OR p_tracking !~ '^[A-Za-z0-9._/-]{3,80}$'
    OR p_buy_price IS NULL OR p_buy_price<0 OR p_buy_price>1000000
    OR p_buy_price::text IN ('NaN','Infinity','-Infinity') OR round(p_buy_price,2)<>p_buy_price
    OR length(coalesce(p_response,''))>2000) THEN
    RAISE EXCEPTION 'Verifique a guia e o custo cobrado pelo parceiro.';
  END IF;
  IF q->>'shipment_id' IS NOT NULL AND q->>'shipment_id'<>p_quote::text THEN
    RAISE EXCEPTION 'A ligação ao envio é inválida.';
  END IF;
  snapshot_id := coalesce((q->>'shipment_audit_id')::uuid,gen_random_uuid());
  SELECT * INTO shipment FROM public.shipments sh WHERE sh.id=p_quote FOR UPDATE;
  IF FOUND THEN
    IF shipment.tenant_id<>p_tenant OR shipment.client_id<>quote_client
      OR q->>'shipment_id' IS DISTINCT FROM p_quote::text OR shipment.status::text<>'rascunho'
      OR coalesce(to_jsonb(shipment)->>'billing_statement_id','')<>''
      OR coalesce(shipment.carrier_tracking_number,'')<>'' THEN
      RAISE EXCEPTION 'O envio já foi emitido, faturado ou está ligado a outro pedido. Atualize a lista.';
    END IF;
  ELSE
    INSERT INTO public.shipments(id,tenant_id,client_id,tracking_number,carrier_code,service_type,status,ops_substatus,
      sender_name,sender_address,sender_zip4,sender_zip3,sender_phone,
      recipient_name,recipient_address,recipient_zip4,recipient_zip3,recipient_phone,recipient_email,
      buy_price,sell_price,created_at,updated_at)
    VALUES(p_quote,p_tenant,quote_client,q->>'reference','correos',q->>'service_name','rascunho','aguarda_emissao_parceiro',
      s->>'senderName',s->>'senderAddress',split_part(s->>'senderPostal','-',1),split_part(s->>'senderPostal','-',2),s->>'senderPhone',
      s->>'recipientName',s->>'recipientAddress',s->>'recipientPostal','',s->>'recipientPhone',s->>'recipientEmail',
      NULL,0,stamp,stamp);
    IF jsonb_typeof(s->'parcelWeightsKg') = 'array' AND jsonb_array_length(s->'parcelWeightsKg') > 0 THEN
      INSERT INTO public.packages(tenant_id,shipment_id,weight_g,dimensions)
        SELECT p_tenant, p_quote, round(w::numeric * 1000)::integer,
          jsonb_build_object('length_cm',s->'lengthCm','width_cm',s->'widthCm','height_cm',s->'heightCm','unit','cm')
        FROM jsonb_array_elements_text(s->'parcelWeightsKg') AS w;
    ELSE
      INSERT INTO public.packages(tenant_id,shipment_id,weight_g,dimensions)
        VALUES(p_tenant,p_quote,round((s->>'weightKg')::numeric*1000)::integer,
          jsonb_build_object('length_cm',s->'lengthCm','width_cm',s->'widthCm','height_cm',s->'heightCm','unit','cm'));
    END IF;
  END IF;
  next_quote := q || jsonb_build_object('shipment_id',p_quote,'shipment_audit_id',snapshot_id,
    'revision',p_revision+1,'updated_at',stamp,'updated_by',p_actor);
  snapshot := jsonb_build_object('id',p_quote,'tenant_id',p_tenant,'client_id',quote_client,
    'tracking_number',q->>'reference','carrier_code','correos','service_type',q->>'service_name','service_id',q->>'service_id',
    'quotation_id',p_quote,'quotation_reference',q->>'reference','pricing_source','quotation','booking_source','linke_partner_account',
    'agreed_price',amount,'status','rascunho','ops_substatus','aguarda_emissao_parceiro',
    'sender_name',s->>'senderName','sender_address',s->>'senderAddress','sender_city',s->>'senderCity',
    'sender_postal',s->>'senderPostal','sender_zip4',split_part(s->>'senderPostal','-',1),'sender_zip3',split_part(s->>'senderPostal','-',2),
    'sender_phone',s->>'senderPhone','recipient_name',s->>'recipientName','recipient_address',s->>'recipientAddress',
    'recipient_city',s->>'recipientCity','recipient_country',s->>'recipientCountry','recipient_postal',s->>'recipientPostal',
    'recipient_zip4',s->>'recipientPostal','recipient_zip3','','recipient_phone',s->>'recipientPhone','recipient_email',s->>'recipientEmail',
    'weight_kg',s->'weightKg','package_count',s->'volumesCount','parcel_weights_kg',s->'parcelWeightsKg',
    'length_cm',s->'lengthCm','width_cm',s->'widthCm','height_cm',s->'heightCm','observations',s->>'observations',
    'buy_price',NULL,'sell_price',0,'base_price',0,'fuel_tax_amount',0,'special_fees_amount',0,
    'requested_at',q->>'created_at','accepted_at',coalesce(q->>'accepted_at',stamp::text),'created_at',stamp,'updated_at',stamp);
  IF p_action='accept' THEN
    next_quote := next_quote || jsonb_build_object('status','accepted','accepted_at',stamp);
  ELSE
    -- Reuse the established wallet/credit rules, inside this same transaction.
    -- A failure rolls back the shipment, snapshot, quotation and reservation.
    prepaid := profile->>'billing_type'='pay_as_you_go';
    IF prepaid THEN
      IF to_regprocedure('public.reserve_shipment_wallet(uuid,uuid,uuid,numeric,text)') IS NULL
        OR to_regprocedure('public.transition_wallet_reservation(uuid,uuid,uuid,text,text,jsonb)') IS NULL THEN
        RAISE EXCEPTION 'A wallet não está preparada para confirmar este envio. Contacte o administrador antes de emitir a guia.';
      END IF;
      reservation := public.reserve_shipment_wallet(p_tenant,quote_client,p_quote,amount,q->>'reference');
    ELSIF profile->>'credit_limit_enabled'='true' THEN
      IF to_regprocedure('public.reserve_current_account_credit(uuid,uuid,uuid,numeric,text)') IS NULL
        OR to_regprocedure('public.transition_credit_limit_reservation(uuid,uuid,uuid,text,text,jsonb)') IS NULL THEN
        RAISE EXCEPTION 'O limite de crédito não está preparado para confirmar este envio. Contacte o administrador antes de emitir a guia.';
      END IF;
      reservation := public.reserve_current_account_credit(p_tenant,quote_client,p_quote,amount,q->>'reference');
      credit_hold := true;
    END IF;
    IF reservation->>'refused'='true' THEN RAISE EXCEPTION 'Saldo ou crédito insuficiente para registar este envio.'; END IF;
    UPDATE public.shipments SET status='pendente',ops_substatus=NULL,carrier_tracking_number=p_tracking,
      buy_price=p_buy_price,sell_price=amount,created_at=stamp,updated_at=stamp
      WHERE id=p_quote AND tenant_id=p_tenant AND public.shipments.client_id=quote_client;
    snapshot := snapshot || jsonb_build_object('status','pendente','ops_substatus',NULL,'carrier_tracking_number',p_tracking,
      'buy_price',p_buy_price,'sell_price',amount,'base_price',amount,'billing_type',profile->>'billing_type',
      'booked_by',p_actor,'booked_at',stamp);
    next_quote := next_quote || jsonb_build_object('status','completed','tracking_number',p_tracking,'partner_cost',p_buy_price,
      'billing_type',profile->>'billing_type','booked_by',p_actor,'booked_at',stamp);
    IF coalesce(p_response,'')<>'' THEN next_quote := next_quote || jsonb_build_object('completion_notes',p_response); END IF;
    IF reservation->>'reserved'='true' THEN
      IF credit_hold THEN
        IF NOT public.transition_credit_limit_reservation(p_tenant,quote_client,p_quote,'reserved','consumed',snapshot) THEN
          RAISE EXCEPTION 'Não foi possível confirmar a reserva de crédito.';
        END IF;
      ELSIF NOT public.transition_wallet_reservation(p_tenant,quote_client,p_quote,'reserved','consumed',snapshot) THEN
        RAISE EXCEPTION 'Não foi possível confirmar a reserva de saldo.';
      END IF;
    END IF;
  END IF;
  INSERT INTO public.audit_log(id,tenant_id,action,details,created_at)
    VALUES(snapshot_id,p_tenant,'shipment_data',snapshot,stamp)
    ON CONFLICT(id) DO UPDATE SET details=excluded.details,created_at=excluded.created_at
      WHERE public.audit_log.tenant_id=p_tenant AND public.audit_log.action='shipment_data'
        AND public.audit_log.details->>'quotation_id'=p_quote::text;
  IF NOT FOUND THEN RAISE EXCEPTION 'A referência do envio já está ocupada.'; END IF;
  UPDATE public.audit_log SET details=next_quote WHERE id=p_quote AND tenant_id=p_tenant AND action='shipment_quote_request';
  RETURN next_quote;
END $$;
REVOKE ALL ON FUNCTION public.materialize_shipment_quotation(uuid,uuid,integer,uuid,uuid,text,text,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.materialize_shipment_quotation(uuid,uuid,integer,uuid,uuid,text,text,numeric,text) TO service_role;
NOTIFY pgrst,'reload schema';

-- SOURCE: 20261106140000_quotation_partner_tracking.sql
-- Extend manual partner booking with an explicit tracking carrier.
-- Commercial carrier/pricing stays Correos; FedEx tracking is external.
-- Definitions only: no existing shipment, quotation or balance is rewritten.
CREATE OR REPLACE FUNCTION public.materialize_shipment_quotation(
  p_tenant uuid, p_quote uuid, p_revision integer, p_actor uuid,
  p_client uuid, p_action text, p_tracking text,
  p_buy_price numeric, p_response text, p_tracking_carrier text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  q jsonb; s jsonb; profile jsonb; snapshot jsonb; next_quote jsonb;
  quote_client uuid; snapshot_id uuid; shipment public.shipments%ROWTYPE;
  amount numeric; reservation jsonb; prepaid boolean; credit_hold boolean := false;
  stamp timestamptz := now();
BEGIN
  IF p_actor IS NULL OR p_revision IS NULL OR p_revision<0 OR p_action IS NULL OR p_action NOT IN ('accept','complete') THEN
    RAISE EXCEPTION 'Pedido de envio inválido.';
  END IF;
  SELECT a.details INTO q FROM public.audit_log a
    WHERE a.id=p_quote AND a.tenant_id=p_tenant AND a.action='shipment_quote_request' FOR UPDATE;
  IF q IS NULL OR q->>'id' IS DISTINCT FROM p_quote::text
    OR (p_client IS NOT NULL AND q->>'client_id' IS DISTINCT FROM p_client::text) THEN
    RAISE EXCEPTION 'Cotação indisponível ou sem acesso.';
  END IF;
  IF (q->>'revision')::integer IS DISTINCT FROM p_revision THEN
    RAISE EXCEPTION 'Esta cotação foi atualizada. Atualize a lista antes de continuar.';
  END IF;
  IF (p_action='accept' AND (p_client IS NULL OR q->>'status' IS DISTINCT FROM 'quoted'))
    OR (p_action='complete' AND (p_client IS NOT NULL OR q->>'status' IS DISTINCT FROM 'accepted')) THEN
    RAISE EXCEPTION 'Esta alteração já não é possível no estado atual da cotação.';
  END IF;
  quote_client := (q->>'client_id')::uuid;
  PERFORM 1 FROM public.clients c WHERE c.id=quote_client AND c.tenant_id=p_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente indisponível.'; END IF;
  SELECT a.details INTO profile FROM public.audit_log a WHERE a.tenant_id=p_tenant
    AND a.action='client_data' AND a.details->>'id'=quote_client::text ORDER BY a.created_at DESC,a.id DESC LIMIT 1;
  IF profile IS NULL OR profile->>'is_active'='false'
    OR EXISTS(SELECT 1 FROM public.audit_log a WHERE a.tenant_id=p_tenant AND a.action='deleted_client' AND a.details->>'id'=quote_client::text) THEN
    RAISE EXCEPTION 'Não foi possível validar a conta do cliente.';
  END IF;
  IF profile->>'billing_type' IS NULL OR profile->>'billing_type' NOT IN ('conta_corrente','pay_as_you_go') THEN
    RAISE EXCEPTION 'Confirme as condições de faturação do cliente.';
  END IF;
  amount := (q->>'proposed_price')::numeric;
  IF amount IS NULL OR amount<=0 OR amount>1000000 OR amount::text IN ('NaN','Infinity','-Infinity') OR round(amount,2)<>amount THEN
    RAISE EXCEPTION 'A cotação não tem um preço válido.';
  END IF;
  s := q->'shipment';
  IF s->>'recipientCountry' IS NULL OR s->>'recipientCountry' IN ('PT','ES') THEN
    RAISE EXCEPTION 'Este envio não pertence ao fluxo internacional por cotação.';
  END IF;
  IF p_action='complete' AND (p_tracking_carrier IS NULL OR p_tracking_carrier NOT IN ('correos','fedex')
    OR (p_tracking_carrier='fedex' AND p_tracking !~ '^[0-9]{10,34}$') OR p_tracking IS NULL OR p_tracking !~ '^[A-Za-z0-9._/-]{3,80}$'
    OR p_buy_price IS NULL OR p_buy_price<0 OR p_buy_price>1000000
    OR p_buy_price::text IN ('NaN','Infinity','-Infinity') OR round(p_buy_price,2)<>p_buy_price
    OR length(coalesce(p_response,''))>2000) THEN
    RAISE EXCEPTION 'Verifique a guia e o custo cobrado pelo parceiro.';
  END IF;
  IF q->>'shipment_id' IS NOT NULL AND q->>'shipment_id'<>p_quote::text THEN
    RAISE EXCEPTION 'A ligação ao envio é inválida.';
  END IF;
  snapshot_id := coalesce((q->>'shipment_audit_id')::uuid,gen_random_uuid());
  SELECT * INTO shipment FROM public.shipments sh WHERE sh.id=p_quote FOR UPDATE;
  IF FOUND THEN
    IF shipment.tenant_id<>p_tenant OR shipment.client_id<>quote_client
      OR q->>'shipment_id' IS DISTINCT FROM p_quote::text OR shipment.status::text<>'rascunho'
      OR coalesce(to_jsonb(shipment)->>'billing_statement_id','')<>''
      OR coalesce(shipment.carrier_tracking_number,'')<>'' THEN
      RAISE EXCEPTION 'O envio já foi emitido, faturado ou está ligado a outro pedido. Atualize a lista.';
    END IF;
  ELSE
    INSERT INTO public.shipments(id,tenant_id,client_id,tracking_number,carrier_code,service_type,status,ops_substatus,
      sender_name,sender_address,sender_zip4,sender_zip3,sender_phone,
      recipient_name,recipient_address,recipient_zip4,recipient_zip3,recipient_phone,recipient_email,
      buy_price,sell_price,created_at,updated_at)
    VALUES(p_quote,p_tenant,quote_client,q->>'reference','correos',q->>'service_name','rascunho','aguarda_emissao_parceiro',
      s->>'senderName',s->>'senderAddress',split_part(s->>'senderPostal','-',1),split_part(s->>'senderPostal','-',2),s->>'senderPhone',
      s->>'recipientName',s->>'recipientAddress',s->>'recipientPostal','',s->>'recipientPhone',s->>'recipientEmail',
      NULL,0,stamp,stamp);
    IF jsonb_typeof(s->'parcelWeightsKg') = 'array' AND jsonb_array_length(s->'parcelWeightsKg') > 0 THEN
      INSERT INTO public.packages(tenant_id,shipment_id,weight_g,dimensions)
        SELECT p_tenant, p_quote, round(w::numeric * 1000)::integer,
          jsonb_build_object('length_cm',s->'lengthCm','width_cm',s->'widthCm','height_cm',s->'heightCm','unit','cm')
        FROM jsonb_array_elements_text(s->'parcelWeightsKg') AS w;
    ELSE
      INSERT INTO public.packages(tenant_id,shipment_id,weight_g,dimensions)
        VALUES(p_tenant,p_quote,round((s->>'weightKg')::numeric*1000)::integer,
          jsonb_build_object('length_cm',s->'lengthCm','width_cm',s->'widthCm','height_cm',s->'heightCm','unit','cm'));
    END IF;
  END IF;
  next_quote := q || jsonb_build_object('shipment_id',p_quote,'shipment_audit_id',snapshot_id,
    'revision',p_revision+1,'updated_at',stamp,'updated_by',p_actor);
  snapshot := jsonb_build_object('id',p_quote,'tenant_id',p_tenant,'client_id',quote_client,
    'tracking_number',q->>'reference','carrier_code','correos','service_type',q->>'service_name','service_id',q->>'service_id',
    'quotation_id',p_quote,'quotation_reference',q->>'reference','pricing_source','quotation','booking_source','linke_partner_account',
    'agreed_price',amount,'status','rascunho','ops_substatus','aguarda_emissao_parceiro',
    'sender_name',s->>'senderName','sender_address',s->>'senderAddress','sender_city',s->>'senderCity',
    'sender_postal',s->>'senderPostal','sender_zip4',split_part(s->>'senderPostal','-',1),'sender_zip3',split_part(s->>'senderPostal','-',2),
    'sender_phone',s->>'senderPhone','recipient_name',s->>'recipientName','recipient_address',s->>'recipientAddress',
    'recipient_city',s->>'recipientCity','recipient_country',s->>'recipientCountry','recipient_postal',s->>'recipientPostal',
    'recipient_zip4',s->>'recipientPostal','recipient_zip3','','recipient_phone',s->>'recipientPhone','recipient_email',s->>'recipientEmail',
    'weight_kg',s->'weightKg','package_count',s->'volumesCount','parcel_weights_kg',s->'parcelWeightsKg',
    'length_cm',s->'lengthCm','width_cm',s->'widthCm','height_cm',s->'heightCm','observations',s->>'observations',
    'buy_price',NULL,'sell_price',0,'base_price',0,'fuel_tax_amount',0,'special_fees_amount',0,
    'requested_at',q->>'created_at','accepted_at',coalesce(q->>'accepted_at',stamp::text),'created_at',stamp,'updated_at',stamp);
  IF p_action='accept' THEN
    next_quote := next_quote || jsonb_build_object('status','accepted','accepted_at',stamp);
  ELSE
    -- Reuse the established wallet/credit rules, inside this same transaction.
    -- A failure rolls back the shipment, snapshot, quotation and reservation.
    prepaid := profile->>'billing_type'='pay_as_you_go';
    IF prepaid THEN
      IF to_regprocedure('public.reserve_shipment_wallet(uuid,uuid,uuid,numeric,text)') IS NULL
        OR to_regprocedure('public.transition_wallet_reservation(uuid,uuid,uuid,text,text,jsonb)') IS NULL THEN
        RAISE EXCEPTION 'A wallet não está preparada para confirmar este envio. Contacte o administrador antes de emitir a guia.';
      END IF;
      reservation := public.reserve_shipment_wallet(p_tenant,quote_client,p_quote,amount,q->>'reference');
    ELSIF profile->>'credit_limit_enabled'='true' THEN
      IF to_regprocedure('public.reserve_current_account_credit(uuid,uuid,uuid,numeric,text)') IS NULL
        OR to_regprocedure('public.transition_credit_limit_reservation(uuid,uuid,uuid,text,text,jsonb)') IS NULL THEN
        RAISE EXCEPTION 'O limite de crédito não está preparado para confirmar este envio. Contacte o administrador antes de emitir a guia.';
      END IF;
      reservation := public.reserve_current_account_credit(p_tenant,quote_client,p_quote,amount,q->>'reference');
      credit_hold := true;
    END IF;
    IF reservation->>'refused'='true' THEN RAISE EXCEPTION 'Saldo ou crédito insuficiente para registar este envio.'; END IF;
    UPDATE public.shipments SET status='pendente',ops_substatus=CASE WHEN p_tracking_carrier='fedex' THEN 'tracking_fedex_externo' ELSE NULL END,carrier_tracking_number=p_tracking,
      buy_price=p_buy_price,sell_price=amount,created_at=stamp,updated_at=stamp
      WHERE id=p_quote AND tenant_id=p_tenant AND public.shipments.client_id=quote_client;
    snapshot := snapshot || jsonb_build_object('status','pendente','ops_substatus',CASE WHEN p_tracking_carrier='fedex' THEN 'tracking_fedex_externo' ELSE NULL END,'carrier_tracking_number',p_tracking,'tracking_carrier',p_tracking_carrier,
      'buy_price',p_buy_price,'sell_price',amount,'base_price',amount,'billing_type',profile->>'billing_type',
      'booked_by',p_actor,'booked_at',stamp);
    next_quote := next_quote || jsonb_build_object('status','completed','tracking_number',p_tracking,'tracking_carrier',p_tracking_carrier,'partner_cost',p_buy_price,
      'billing_type',profile->>'billing_type','booked_by',p_actor,'booked_at',stamp);
    IF coalesce(p_response,'')<>'' THEN next_quote := next_quote || jsonb_build_object('completion_notes',p_response); END IF;
    IF reservation->>'reserved'='true' THEN
      IF credit_hold THEN
        IF NOT public.transition_credit_limit_reservation(p_tenant,quote_client,p_quote,'reserved','consumed',snapshot) THEN
          RAISE EXCEPTION 'Não foi possível confirmar a reserva de crédito.';
        END IF;
      ELSIF NOT public.transition_wallet_reservation(p_tenant,quote_client,p_quote,'reserved','consumed',snapshot) THEN
        RAISE EXCEPTION 'Não foi possível confirmar a reserva de saldo.';
      END IF;
    END IF;
  END IF;
  INSERT INTO public.audit_log(id,tenant_id,action,details,created_at)
    VALUES(snapshot_id,p_tenant,'shipment_data',snapshot,stamp)
    ON CONFLICT(id) DO UPDATE SET details=excluded.details,created_at=excluded.created_at
      WHERE public.audit_log.tenant_id=p_tenant AND public.audit_log.action='shipment_data'
        AND public.audit_log.details->>'quotation_id'=p_quote::text;
  IF NOT FOUND THEN RAISE EXCEPTION 'A referência do envio já está ocupada.'; END IF;
  UPDATE public.audit_log SET details=next_quote WHERE id=p_quote AND tenant_id=p_tenant AND action='shipment_quote_request';
  RETURN next_quote;
END $$;
REVOKE ALL ON FUNCTION public.materialize_shipment_quotation(uuid,uuid,integer,uuid,uuid,text,text,numeric,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.materialize_shipment_quotation(uuid,uuid,integer,uuid,uuid,text,text,numeric,text,text) TO service_role;
NOTIFY pgrst,'reload schema';

COMMIT;
