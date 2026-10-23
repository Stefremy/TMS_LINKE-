-- Persistent per-store inbox. Browser roles never access these tables/RPCs directly.
BEGIN;
CREATE TABLE IF NOT EXISTS public.client_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
 source_key text NOT NULL CHECK(length(source_key) BETWEEN 1 AND 256),
 kind text NOT NULL CHECK(kind IN ('info','invoice','payment','incident','weight')),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 160),
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 4000),
 section text CHECK(section IN ('envios','faturas','carregamentos')), reference text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,client_id,source_key), UNIQUE(id,tenant_id,client_id)
);
CREATE INDEX IF NOT EXISTS client_messages_page ON public.client_messages(tenant_id,client_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS client_messages_kind_page ON public.client_messages(tenant_id,client_id,kind,created_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS public.client_message_reads (
 message_id uuid NOT NULL, tenant_id uuid NOT NULL, client_id uuid NOT NULL, user_id uuid NOT NULL,
 read_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(message_id,user_id),
 FOREIGN KEY(message_id,tenant_id,client_id) REFERENCES public.client_messages(id,tenant_id,client_id) ON DELETE CASCADE
);
ALTER TABLE public.client_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_message_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_messages,public.client_message_reads FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.client_messages,public.client_message_reads TO service_role;

CREATE OR REPLACE FUNCTION public.assert_client_message_scope() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.clients WHERE id=NEW.client_id AND tenant_id=NEW.tenant_id) THEN RAISE EXCEPTION 'Invalid message scope'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS client_message_scope ON public.client_messages;
CREATE TRIGGER client_message_scope BEFORE INSERT OR UPDATE ON public.client_messages FOR EACH ROW EXECUTE FUNCTION public.assert_client_message_scope();

DROP FUNCTION IF EXISTS public.client_message_page(uuid,uuid,uuid,timestamptz,uuid,boolean,integer);
CREATE OR REPLACE FUNCTION public.client_message_page(p_tenant uuid,p_client uuid,p_user uuid,p_before timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL,p_unread boolean DEFAULT false,p_limit integer DEFAULT 20,p_kind text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; unread_count bigint; page_size integer:=least(greatest(COALESCE(p_limit,20),0),30);
BEGIN
 IF p_user IS NULL OR NOT EXISTS(SELECT 1 FROM public.clients WHERE id=p_client AND tenant_id=p_tenant) THEN RAISE EXCEPTION 'Invalid message scope'; END IF;
 IF p_kind IS NOT NULL AND p_kind NOT IN ('info','invoice','payment','incident','weight') THEN RAISE EXCEPTION 'Invalid message kind'; END IF;
 IF (p_before IS NULL)<>(p_before_id IS NULL) THEN RAISE EXCEPTION 'Invalid cursor'; END IF;
 SELECT count(*) INTO unread_count FROM public.client_messages m WHERE m.tenant_id=p_tenant AND m.client_id=p_client
  AND NOT EXISTS(SELECT 1 FROM public.client_message_reads r WHERE r.message_id=m.id AND r.user_id=p_user);
 SELECT COALESCE(jsonb_agg(to_jsonb(page) ORDER BY page.created_at DESC,page.id DESC),'[]'::jsonb) INTO result FROM (
  SELECT m.id,m.kind,m.title,m.body,m.section,m.reference,m.created_at,r.read_at
  FROM public.client_messages m LEFT JOIN public.client_message_reads r ON r.message_id=m.id AND r.user_id=p_user
  WHERE m.tenant_id=p_tenant AND m.client_id=p_client AND (NOT p_unread OR r.message_id IS NULL) AND (p_kind IS NULL OR m.kind=p_kind)
   AND (p_before IS NULL OR (m.created_at,m.id)<(p_before,p_before_id))
  ORDER BY m.created_at DESC,m.id DESC LIMIT page_size+1
 ) page;
 RETURN jsonb_build_object('messages',CASE WHEN page_size=0 THEN '[]'::jsonb ELSE result - page_size END,'unreadCount',unread_count,
  'next',CASE WHEN page_size>0 AND jsonb_array_length(result)>page_size THEN jsonb_build_object('at',result->(page_size-1)->>'created_at','id',result->(page_size-1)->>'id') ELSE NULL END);
END $$;

CREATE OR REPLACE FUNCTION public.mark_client_messages_read(p_tenant uuid,p_client uuid,p_user uuid,p_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_user IS NULL OR COALESCE(array_length(p_ids,1),0) NOT BETWEEN 1 AND 50 OR NOT EXISTS(SELECT 1 FROM public.clients WHERE id=p_client AND tenant_id=p_tenant)
  OR EXISTS(SELECT 1 FROM unnest(p_ids) wanted(id) WHERE NOT EXISTS(SELECT 1 FROM public.client_messages m WHERE m.id=wanted.id AND m.tenant_id=p_tenant AND m.client_id=p_client)) THEN RAISE EXCEPTION 'Invalid message scope'; END IF;
 INSERT INTO public.client_message_reads(message_id,tenant_id,client_id,user_id)
  SELECT DISTINCT id,p_tenant,p_client,p_user FROM unnest(p_ids) id ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.send_client_message(p_tenant uuid,p_client uuid,p_user uuid,p_request uuid,p_title text,p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid; prior public.client_messages;
BEGIN
 IF p_user IS NULL OR p_request IS NULL OR p_title IS NULL OR p_body IS NULL THEN RAISE EXCEPTION 'Invalid message'; END IF;
 INSERT INTO public.client_messages(tenant_id,client_id,source_key,kind,title,body)
 VALUES(p_tenant,p_client,'manual:'||p_user::text||':'||p_request::text,'info',btrim(p_title),btrim(p_body))
 ON CONFLICT(tenant_id,client_id,source_key) DO NOTHING RETURNING id INTO result;
 IF result IS NOT NULL THEN RETURN result; END IF;
 SELECT * INTO prior FROM public.client_messages WHERE tenant_id=p_tenant AND client_id=p_client AND source_key='manual:'||p_user::text||':'||p_request::text;
 IF prior.title IS DISTINCT FROM btrim(p_title) OR prior.body IS DISTINCT FROM btrim(p_body) THEN RAISE EXCEPTION 'Message retry mismatch'; END IF;
 RETURN prior.id;
END $$;

-- Notification delivery cannot roll back a payment, invoice or tracking operation.
-- Parent records remain the source of truth; trigger replay is idempotent.
CREATE OR REPLACE FUNCTION public.notify_client_system_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c uuid; k text; title text; body text; section text; ref text; kind text; info jsonb;
BEGIN
 IF TG_TABLE_NAME='client_transactions' THEN
  IF NEW.status<>'paid' OR NEW.credited_at IS NULL OR NEW.amount<=0 OR NEW.amount::text IN ('NaN','Infinity','-Infinity') THEN RETURN NEW; END IF;
  c:=NEW.client_id; k:='payment:'||NEW.id::text; kind:='payment'; title:='Carregamento confirmado'; section:='carregamentos';
  body:='O carregamento de '||replace(NEW.amount::text,'.',',')||' € foi confirmado e creditado na sua conta.';
 ELSIF TG_TABLE_NAME='shipments' THEN
  IF NEW.status::text<>'incidencia' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status AND OLD.ops_substatus IS NOT DISTINCT FROM NEW.ops_substatus THEN RETURN NEW; END IF;
  c:=NEW.client_id; ref:=COALESCE(NEW.tracking_number,NEW.carrier_tracking_number,NEW.id::text);
  k:='incident:'||NEW.id::text||':'||md5(COALESCE(NEW.ops_substatus,'')||COALESCE(NEW.updated_at::text,''));kind:='incident';title:='Incidência no envio '||ref;section:='envios';
  body:='Foi comunicada uma incidência no envio '||ref||'. Consulte o histórico do envio para acompanhar a situação.';
 ELSE
  info:=NEW.details;
  IF NEW.action='shipment_weight_adjustment' THEN
   SELECT client_id,COALESCE(tracking_number,carrier_tracking_number,id::text) INTO c,ref FROM public.shipments WHERE tenant_id=NEW.tenant_id AND id::text=info->>'shipment_id' AND client_id::text=info->>'client_id';
   IF c IS NULL THEN RETURN NEW; END IF;
   k:='weight:'||NEW.id::text;kind:='weight';title:='Ajuste de escalão por peso';section:='envios';
   body:='O peso de cobrança passou de '||COALESCE(info->>'previousWeightKg','—')||' kg para '||COALESCE(info->>'weightKg','—')||' kg. O preço passou de '||COALESCE(info->>'previousPrice','—')||' € para '||COALESCE(info->>'price','—')||' € (sem IVA). Diferença: '||COALESCE(info->>'difference','—')||' €.';
  ELSIF NEW.action='billing_statement' THEN
   IF COALESCE(info->>'moloni_document_id','')!~'^[1-9][0-9]*$' OR COALESCE(info->>'is_pro_forma','false')='true' THEN RETURN NEW; END IF;
   c:=(info->>'client_id')::uuid;ref:=COALESCE(info->>'moloni_document_number',info->>'statement_number','');section:='faturas';
   IF COALESCE(info->>'moloni_receipt_id','')~'^[1-9][0-9]*$' THEN
    k:='receipt:'||(info->>'moloni_receipt_id');kind:='payment';title:='Pagamento registado';body:='O pagamento da fatura '||ref||' foi registado. O respetivo recibo está disponível em Faturas e Extratos.';
   ELSE
    k:='invoice:'||(info->>'moloni_document_id');kind:='invoice';title:='Nova fatura disponível';body:='A fatura '||ref||' está disponível para consulta em Faturas e Extratos.';
   END IF;
  ELSE RETURN NEW;
  END IF;
 END IF;
 IF c IS NULL OR NOT EXISTS(SELECT 1 FROM public.clients WHERE id=c AND tenant_id=NEW.tenant_id) THEN RETURN NEW; END IF;
 INSERT INTO public.client_messages(tenant_id,client_id,source_key,kind,title,body,section,reference)
 VALUES(NEW.tenant_id,c,k,kind,left(title,160),left(body,4000),section,ref) ON CONFLICT(tenant_id,client_id,source_key) DO NOTHING;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Client notification deferred: %',SQLSTATE; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS client_message_audit_event ON public.audit_log;
CREATE TRIGGER client_message_audit_event AFTER INSERT OR UPDATE ON public.audit_log FOR EACH ROW
 WHEN (NEW.action IN ('shipment_weight_adjustment','billing_statement')) EXECUTE FUNCTION public.notify_client_system_event();
DROP TRIGGER IF EXISTS client_message_payment_event ON public.client_transactions;
CREATE TRIGGER client_message_payment_event AFTER INSERT OR UPDATE ON public.client_transactions FOR EACH ROW EXECUTE FUNCTION public.notify_client_system_event();
DROP TRIGGER IF EXISTS client_message_incident_event ON public.shipments;
CREATE TRIGGER client_message_incident_event AFTER INSERT OR UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.notify_client_system_event();

REVOKE ALL ON FUNCTION public.assert_client_message_scope(),public.notify_client_system_event(),public.client_message_page(uuid,uuid,uuid,timestamptz,uuid,boolean,integer,text),public.mark_client_messages_read(uuid,uuid,uuid,uuid[]),public.send_client_message(uuid,uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.client_message_page(uuid,uuid,uuid,timestamptz,uuid,boolean,integer,text),public.mark_client_messages_read(uuid,uuid,uuid,uuid[]),public.send_client_message(uuid,uuid,uuid,uuid,text,text) TO service_role;
COMMIT;
