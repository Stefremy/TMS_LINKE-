-- Fiscal issuance is separate from email delivery. Never repeat an uncertain insert.
alter table public.recurring_statement_cycles
  add column if not exists invoice_status text not null default 'pending',
  add column if not exists invoice_token uuid,
  add column if not exists invoice_lease_until timestamptz,
  add column if not exists invoice_payload jsonb,
  add column if not exists invoice_document_id bigint,
  add column if not exists invoice_statement_id uuid not null default gen_random_uuid(),
  add column if not exists invoice_error text;
create table if not exists public.billing_emission_claims (
  tenant_id uuid not null references public.tenants(id),
  shipment_id uuid not null,
  emission_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(tenant_id,shipment_id)
);
alter table public.billing_emission_claims enable row level security;
revoke all on public.billing_emission_claims from anon,authenticated;
grant all on public.billing_emission_claims to service_role;

create or replace function public.claim_billing_shipments(p_tenant uuid,p_client uuid,p_emission uuid,p_shipments uuid[])
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('period:'||p_tenant::text||':'||p_client::text,0));
  if coalesce(array_length(p_shipments,1),0)=0 or exists(
    select 1 from unnest(p_shipments) wanted(id) where not exists(select 1 from public.shipments s
      where s.id=wanted.id and s.tenant_id=p_tenant and s.client_id=p_client
        and s.status::text not in ('rascunho','draft','anulado','cancelado','cancelled','canceled')
        and coalesce(to_jsonb(s)->>'billing_statement_id','')='')
  ) then raise exception 'Envios inválidos ou já faturados.'; end if;
  if exists(select 1 from public.audit_log a where a.tenant_id=p_tenant and a.action='billing_statement'
    and coalesce(a.details->>'is_pro_forma','false')<>'true'
    and coalesce(a.details->>'moloni_document_id','')<>''
    and exists(select 1 from unnest(p_shipments) id where coalesce(a.details->'shipment_ids','[]'::jsonb)?id::text)) then
    raise exception 'Estes envios já têm fatura.';
  end if;
  if exists(select 1 from public.billing_emission_claims c where c.tenant_id=p_tenant
    and c.shipment_id=any(p_shipments) and c.emission_id<>p_emission) then
    raise exception 'Existe uma emissão em curso ou por confirmar para estes envios. Não repita a emissão.';
  end if;
  insert into public.billing_emission_claims(tenant_id,shipment_id,emission_id)
    select p_tenant,id,p_emission from (select distinct unnest(p_shipments) id) s on conflict do nothing;
end $$;

create or replace function public.claim_recurring_invoice(p_tenant uuid,p_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.recurring_statement_cycles%rowtype;
begin
  select * into c from public.recurring_statement_cycles where tenant_id=p_tenant and id=p_id for update;
  if not found or c.delivery_status='empty' then return null; end if;
  if c.invoice_status='issued' then return to_jsonb(c); end if;
  if c.invoice_status='review_required' then return null; end if;
  if not exists(select 1 from public.recurring_statement_settings where tenant_id=p_tenant and enabled) then return null; end if;
  if not exists(select 1 from (select details from public.audit_log where tenant_id=p_tenant and action='client_data'
      and details->>'id'=c.client_id::text order by created_at desc,id desc limit 1) p
    where p.details->>'billing_type'='conta_corrente' and coalesce(p.details->>'is_active','true')<>'false')
    or exists(select 1 from public.audit_log where tenant_id=p_tenant and action='deleted_client' and details->>'id'=c.client_id::text) then return null; end if;
  if c.invoice_lease_until>now() then return null; end if;
  if c.invoice_status='issuing' then
    update public.recurring_statement_cycles set invoice_status='review_required',invoice_error='Confirme a emissão no Moloni antes de repetir.' where id=p_id;
    update public.audit_log set details=details||'{"invoice_status":"review_required"}'::jsonb where tenant_id=p_tenant and id=c.statement_id;
    return null;
  end if;
  update public.recurring_statement_cycles set invoice_status='preparing',invoice_token=gen_random_uuid(),
    invoice_lease_until=now()+interval '5 minutes',invoice_error=null where id=p_id returning * into c;
  return to_jsonb(c);
end $$;

create or replace function public.arm_recurring_invoice(p_tenant uuid,p_id uuid,p_token uuid,p_payload jsonb)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.recurring_statement_cycles%rowtype; doc jsonb; ids uuid[];
begin
  select * into c from public.recurring_statement_cycles where tenant_id=p_tenant and id=p_id for update;
  if not found or c.invoice_token is distinct from p_token or c.invoice_status<>'preparing' or c.invoice_lease_until<=now() then return false; end if;
  if not exists(select 1 from public.recurring_statement_settings where tenant_id=p_tenant and enabled) then return false; end if;
  if not exists(select 1 from (select details from public.audit_log where tenant_id=p_tenant and action='client_data'
      and details->>'id'=c.client_id::text order by created_at desc,id desc limit 1) p
    where p.details->>'billing_type'='conta_corrente' and coalesce(p.details->>'is_active','true')<>'false')
    or exists(select 1 from public.audit_log where tenant_id=p_tenant and action='deleted_client' and details->>'id'=c.client_id::text) then return false; end if;
  select details into doc from public.audit_log where tenant_id=p_tenant and id=c.statement_id and action='period_statement';
  select array_agg(value::uuid) into ids from jsonb_array_elements_text(doc->'shipment_ids');
  perform public.claim_billing_shipments(p_tenant,c.client_id,c.id,ids);
  update public.recurring_statement_cycles set invoice_status='issuing',invoice_payload=p_payload where id=p_id;
  update public.audit_log set details=details||'{"invoice_status":"issuing"}'::jsonb where tenant_id=p_tenant and id=c.statement_id;
  return true;
end $$;

create or replace function public.finish_recurring_invoice(p_tenant uuid,p_id uuid,p_token uuid,p_document bigint,p_number text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.recurring_statement_cycles%rowtype; doc jsonb;
begin
  select * into c from public.recurring_statement_cycles where tenant_id=p_tenant and id=p_id for update;
  if not found or c.invoice_token is distinct from p_token or c.invoice_status<>'issuing' or p_document<=0 or p_document is null then return false; end if;
  select details into doc from public.audit_log where tenant_id=p_tenant and id=c.statement_id and action='period_statement';
  insert into public.audit_log(id,tenant_id,action,details) values(c.invoice_statement_id,p_tenant,'billing_statement',
    doc||jsonb_build_object('id',c.invoice_statement_id,'period_statement_id',c.id,'document_type','invoice',
      'moloni_document_id',p_document,'moloni_document_number',p_number,'is_pro_forma',false,'status','unpaid','created_at',now()));
  update public.audit_log set details=details||jsonb_build_object('invoice_status','issued','invoice_statement_id',c.invoice_statement_id,
    'moloni_document_id',p_document,'moloni_document_number',p_number) where tenant_id=p_tenant and id=c.statement_id;
  update public.recurring_statement_cycles set invoice_status='issued',invoice_document_id=p_document,invoice_error=null,invoice_lease_until=null where id=p_id;
  if to_regclass('public.billing_statements') is not null then
    insert into public.billing_statements(id,tenant_id,client_id,statement_number,moloni_document_id,moloni_document_pdf,total_value,shipments_count,created_at)
      select r.id,r.tenant_id,r.client_id,r.statement_number,r.moloni_document_id,r.moloni_document_pdf,r.total_value,r.shipments_count,r.created_at
      from jsonb_populate_record(null::public.billing_statements,doc||jsonb_build_object('id',c.invoice_statement_id,'tenant_id',p_tenant,
        'moloni_document_id',p_document,'moloni_document_pdf',null,'created_at',now())) r;
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='shipments' and column_name='billing_statement_id') then
    execute 'update public.shipments set billing_statement_id=$1 where tenant_id=$2 and client_id=$3 and id in (select value::uuid from jsonb_array_elements_text($4))'
      using c.invoice_statement_id,p_tenant,c.client_id,doc->'shipment_ids';
  end if;
  return true;
end $$;

create or replace function public.fail_recurring_invoice(p_tenant uuid,p_id uuid,p_token uuid,p_error text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.recurring_statement_cycles%rowtype; state text;
begin
  select * into c from public.recurring_statement_cycles where tenant_id=p_tenant and id=p_id for update;
  if not found or c.invoice_token is distinct from p_token or c.invoice_status='issued' then return; end if;
  state:=case when c.invoice_status='issuing' then 'review_required' else 'blocked' end;
  update public.recurring_statement_cycles set invoice_status=state,invoice_error=left(p_error,500),invoice_lease_until=now()+interval '1 hour' where id=p_id;
  update public.audit_log set details=details||jsonb_build_object('invoice_status',state,'invoice_error',left(p_error,500)) where tenant_id=p_tenant and id=c.statement_id;
end $$;

revoke all on function public.claim_billing_shipments(uuid,uuid,uuid,uuid[]) from public,anon,authenticated;
revoke all on function public.claim_recurring_invoice(uuid,uuid) from public,anon,authenticated;
revoke all on function public.arm_recurring_invoice(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.finish_recurring_invoice(uuid,uuid,uuid,bigint,text) from public,anon,authenticated;
revoke all on function public.fail_recurring_invoice(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_billing_shipments(uuid,uuid,uuid,uuid[]),public.claim_recurring_invoice(uuid,uuid),
  public.arm_recurring_invoice(uuid,uuid,uuid,jsonb),public.finish_recurring_invoice(uuid,uuid,uuid,bigint,text),
  public.fail_recurring_invoice(uuid,uuid,uuid,text) to service_role;

-- Client profiles are replaced on save. Carry the billing-mode epoch into the new
-- profile before the previous record is removed, so prepaid history cannot leak
-- into a later current-account cycle.
create or replace function public.preserve_recurring_client_window()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare previous jsonb; anchor date; started date;
begin
  if new.action<>'client_data' or coalesce(new.details->>'billing_type','')<>'conta_corrente' then return new; end if;
  select details into previous from public.audit_log where tenant_id=new.tenant_id and action='client_data'
    and details->>'id'=new.details->>'id' and id<>new.id order by created_at desc,id desc limit 1;
  select anchor_date into anchor from public.recurring_statement_settings where tenant_id=new.tenant_id;
  if previous is not null and (coalesce(previous->>'billing_type','')<>'conta_corrente' or previous->>'is_active'='false') then
    started:=(new.created_at at time zone 'Europe/Lisbon')::date;
  else
    started:=coalesce(nullif(previous->>'recurring_since','')::date,
      greatest(anchor,(nullif(new.details->>'created_at','')::timestamptz at time zone 'Europe/Lisbon')::date),
      (new.created_at at time zone 'Europe/Lisbon')::date);
  end if;
  new.details:=new.details||jsonb_build_object('recurring_since',started);
  return new;
end $$;
revoke all on function public.preserve_recurring_client_window() from public,anon,authenticated;
drop trigger if exists preserve_recurring_client_window on public.audit_log;
create trigger preserve_recurring_client_window before insert on public.audit_log for each row execute function public.preserve_recurring_client_window();

create or replace function public.reserve_recurring_statement(p_tenant uuid,p_client uuid,p_start date,p_end date)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  cfg public.recurring_statement_settings%rowtype;
  previous_end date;
  initial_start date;
  eligibility_start date;
  last_ineligible record;
  client jsonb;
  days integer;
  items jsonb;
  amount numeric;
  cycle_id uuid := gen_random_uuid();
  details jsonb;
  statement_number text;
begin
  perform pg_advisory_xact_lock(hashtextextended('period:'||p_tenant::text||':'||p_client::text,0));
  select * into cfg from public.recurring_statement_settings where tenant_id=p_tenant;
  if not found or not cfg.enabled then return jsonb_build_object('skipped','disabled'); end if;
  if not exists(select 1 from public.clients where id=p_client and tenant_id=p_tenant) then
    raise exception 'Cliente não encontrado nesta empresa.';
  end if;
  select a.details into client from public.audit_log a where a.tenant_id=p_tenant
    and a.action='client_data' and a.details->>'id'=p_client::text
    order by a.created_at desc,a.id desc limit 1;
  if client is null or coalesce(client->>'billing_type','') <> 'conta_corrente'
    or client->>'is_active'='false' or exists(select 1 from public.audit_log a
      where a.tenant_id=p_tenant and a.action='deleted_client' and a.details->>'id'=p_client::text) then
    return jsonb_build_object('skipped','ineligible');
  end if;
  days := case when lower(trim(client->>'payment_terms'))='pronto pagamento' then 1
    when trim(client->>'payment_terms') ~* '^A (7|15|30|45|60|90) dias$'
      then substring(client->>'payment_terms' from '[0-9]+')::integer else null end;
  if days is null then raise exception 'Condição de pagamento não suportada.'; end if;
  select max(period_end) into previous_end from public.recurring_statement_cycles
    where tenant_id=p_tenant and client_id=p_client;
  initial_start := greatest(cfg.anchor_date,coalesce((nullif(client->>'created_at','')::timestamptz at time zone 'Europe/Lisbon')::date,cfg.anchor_date));
  select a.created_at,a.id into last_ineligible from public.audit_log a
    where a.tenant_id=p_tenant and a.action='client_data' and a.details->>'id'=p_client::text
      and (coalesce(a.details->>'billing_type','')<>'conta_corrente' or a.details->>'is_active'='false')
    order by a.created_at desc,a.id desc limit 1;
  if found then
    select (min(a.created_at) at time zone 'Europe/Lisbon')::date into eligibility_start
      from public.audit_log a where a.tenant_id=p_tenant and a.action='client_data'
        and a.details->>'id'=p_client::text and (a.created_at,a.id)>(last_ineligible.created_at,last_ineligible.id);
  end if;
  initial_start := greatest(initial_start,eligibility_start,previous_end,nullif(client->>'recurring_since','')::date);
  if p_start <> initial_start then
    return jsonb_build_object('skipped','already_closed_or_stale');
  end if;
  if p_end <> p_start+days or p_end > (now() at time zone 'Europe/Lisbon')::date then
    raise exception 'O período ainda não está fechado ou tem limites inválidos.';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',s.id,'tracking_number',s.tracking_number,'created_at',s.created_at,
      'service_type',s.service_type,'recipient_name',s.recipient_name,'recipient_address',s.recipient_address,
      'recipient_city',to_jsonb(s)->>'recipient_city','sell_price',s.sell_price,
      'base_price',to_jsonb(s)->'base_price','fuel_tax_amount',to_jsonb(s)->'fuel_tax_amount',
      'special_fees_amount',to_jsonb(s)->'special_fees_amount','weight_kg',to_jsonb(s)->'weight_kg'
    ) order by s.created_at,s.id),'[]'::jsonb),coalesce(sum(round(s.sell_price,2)),0)
    into items,amount from public.shipments s
    where s.tenant_id=p_tenant and s.client_id=p_client
      and s.created_at >= (p_start::timestamp at time zone 'Europe/Lisbon')
      and s.created_at < (p_end::timestamp at time zone 'Europe/Lisbon')
      and s.status::text not in ('rascunho','anulado','cancelado','draft','cancelled','canceled')
      and coalesce(to_jsonb(s)->>'billing_statement_id','')=''
      and not exists(select 1 from public.audit_log a where a.tenant_id=p_tenant
        and a.action='billing_statement' and a.details->>'client_id'=p_client::text
        and (coalesce(a.details->>'moloni_document_id','')<>'' or coalesce(a.details->>'moloni_document_pdf','')<>'')
        and coalesce(a.details->>'is_pro_forma','false')<>'true'
        and coalesce(a.details->'shipment_ids','[]'::jsonb) ? s.id::text);
  if exists(select 1 from jsonb_array_elements(items) item where item->>'sell_price' is null
      or (item->>'sell_price')::numeric<0) then raise exception 'Há envios sem preço válido.'; end if;
  if jsonb_array_length(items)=0 then
    insert into public.recurring_statement_cycles(id,tenant_id,client_id,period_start,period_end,cycle_days,delivery_status)
      values(cycle_id,p_tenant,p_client,p_start,p_end,days,'empty');
    return jsonb_build_object('id',cycle_id,'empty',true);
  end if;
  statement_number := 'EXT-AUTO/'||to_char(p_start,'YYYYMMDD')||'/'||substr(replace(cycle_id::text,'-',''),1,12);
  details := jsonb_build_object('id',cycle_id,'client_id',p_client,'client_name',coalesce(client->>'short_name',client->>'legal_name'),
    'document_type','period_statement','statement_number',statement_number,'period_start',p_start,'period_end',p_end,
    'cycle_days',days,'total_value',amount,'shipments_count',jsonb_array_length(items),'shipments',items,
    'shipment_ids',(select jsonb_agg(i->>'id') from jsonb_array_elements(items) i),
    'client_snapshot',jsonb_build_object('name',coalesce(client->>'short_name',client->>'legal_name'),
      'nif',client->>'nif','address',client->>'address','city',client->>'city'),
    'email_status','pending','created_at',now());
  insert into public.audit_log(id,tenant_id,action,details) values(cycle_id,p_tenant,'period_statement',details);
  insert into public.recurring_statement_cycles(id,tenant_id,client_id,period_start,period_end,cycle_days,statement_id)
    values(cycle_id,p_tenant,p_client,p_start,p_end,days,cycle_id);
  return jsonb_build_object('id',cycle_id,'statement_id',cycle_id,'empty',false);
end $$;
