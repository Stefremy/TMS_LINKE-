-- Extend manual partner booking with an explicit tracking carrier.
-- Commercial carrier/pricing stays Correos; FedEx tracking is external.
-- Definitions only: no existing shipment, quotation or balance is rewritten.
BEGIN;
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
