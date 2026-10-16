-- Internal period statements: no fiscal document, wallet debit or billed-shipment mutation.
create table if not exists public.recurring_statement_settings (
  tenant_id uuid primary key references public.tenants(id),
  enabled boolean not null default false,
  anchor_date date not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.recurring_statement_cycles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  client_id uuid not null,
  period_start date not null,
  period_end date not null,
  cycle_days integer not null check (cycle_days in (1,7,15,30,45,60,90)),
  statement_id uuid references public.audit_log(id),
  delivery_status text not null default 'pending'
    check (delivery_status in ('empty','pending','processing','failed','blocked','sent','review_required')),
  email_payload jsonb,
  first_attempt_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz,
  attempts integer not null default 0,
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, client_id, period_start),
  check (period_end = period_start + cycle_days)
);
create index if not exists recurring_statement_delivery_idx
  on public.recurring_statement_cycles (tenant_id,delivery_status,next_attempt_at);
alter table public.recurring_statement_settings enable row level security;
alter table public.recurring_statement_cycles enable row level security;
revoke all on public.recurring_statement_settings, public.recurring_statement_cycles from anon, authenticated;
grant all on public.recurring_statement_settings, public.recurring_statement_cycles to service_role;

create or replace function public.configure_recurring_statements(p_tenant uuid,p_enabled boolean,p_anchor date)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare existing_anchor date;
begin
  perform pg_advisory_xact_lock(hashtextextended('period-settings:'||p_tenant::text,0));
  select anchor_date into existing_anchor from public.recurring_statement_settings where tenant_id=p_tenant;
  if existing_anchor is null and p_anchor < (now() at time zone 'Europe/Lisbon')::date then
    raise exception 'A ativação não pode incluir períodos anteriores.';
  end if;
  if existing_anchor is not null and existing_anchor <> p_anchor then
    raise exception 'A data inicial dos ciclos já está fixada. Suspenda ou retome sem alterar o histórico.';
  end if;
  insert into public.recurring_statement_settings(tenant_id,enabled,anchor_date)
    values(p_tenant,p_enabled,p_anchor)
    on conflict(tenant_id) do update set enabled=excluded.enabled,updated_at=now();
end $$;

create or replace function public.reserve_recurring_statement(p_tenant uuid,p_client uuid,p_start date,p_end date)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  cfg public.recurring_statement_settings%rowtype;
  previous_end date;
  initial_start date;
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
  if client is null or client->>'billing_type' <> 'conta_corrente'
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
  if p_start <> coalesce(previous_end,initial_start) then
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
        and coalesce(a.details->>'moloni_document_id','')<>''
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

create or replace function public.claim_recurring_statement_email(p_tenant uuid,p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare cycle public.recurring_statement_cycles%rowtype;
begin
  select * into cycle from public.recurring_statement_cycles where tenant_id=p_tenant and id=p_id for update;
  if not found or cycle.delivery_status in ('sent','empty','review_required') then return null; end if;
  if not exists(select 1 from public.recurring_statement_settings where tenant_id=p_tenant and enabled) then return null; end if;
  if cycle.delivery_status='processing' and cycle.lease_until>now() then return null; end if;
  if cycle.next_attempt_at>now() then return null; end if;
  if cycle.first_attempt_at is not null and cycle.first_attempt_at < now()-interval '23 hours' then
    update public.recurring_statement_cycles set delivery_status='review_required',last_error='Confirme a entrega antes de repetir.',lease_token=null,lease_until=null where id=p_id;
    update public.audit_log set details=details||'{"email_status":"review_required"}'::jsonb where id=cycle.statement_id and tenant_id=p_tenant;
    return null;
  end if;
  update public.recurring_statement_cycles set delivery_status='processing',lease_token=gen_random_uuid(),
    lease_until=now()+interval '5 minutes',attempts=attempts+1 where id=p_id returning * into cycle;
  return to_jsonb(cycle);
end $$;

-- Persist the exact payload BEFORE the first network attempt; every retry reuses it.
create or replace function public.prepare_recurring_statement_email(p_tenant uuid,p_id uuid,p_token uuid,p_payload jsonb)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.recurring_statement_cycles set email_payload=coalesce(email_payload,p_payload),
    first_attempt_at=coalesce(first_attempt_at,now())
    where tenant_id=p_tenant and id=p_id and lease_token=p_token and delivery_status='processing' and lease_until>now();
  return found;
end $$;

create or replace function public.finish_recurring_statement_email(p_tenant uuid,p_id uuid,p_token uuid,p_status text,p_message_id text,p_error text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare stmt_id uuid;
begin
  if p_status not in ('sent','failed','blocked') then raise exception 'Estado de envio inválido.'; end if;
  update public.recurring_statement_cycles set delivery_status=p_status,provider_message_id=p_message_id,
    last_error=left(p_error,500),sent_at=case when p_status='sent' then now() else sent_at end,
    next_attempt_at=case when p_status<>'sent' then now()+interval '1 hour' else null end,
    lease_token=null,lease_until=null where tenant_id=p_tenant and id=p_id and lease_token=p_token
    and delivery_status='processing' returning statement_id into stmt_id;
  if not found then return false; end if;
  update public.audit_log set details=details||jsonb_build_object('email_status',p_status,'email_sent_at',
    case when p_status='sent' then now() else null end,'email_error',left(p_error,500)) where tenant_id=p_tenant and id=stmt_id;
  return true;
end $$;

revoke all on function public.configure_recurring_statements(uuid,boolean,date) from public,anon,authenticated;
revoke all on function public.reserve_recurring_statement(uuid,uuid,date,date) from public,anon,authenticated;
revoke all on function public.claim_recurring_statement_email(uuid,uuid) from public,anon,authenticated;
revoke all on function public.prepare_recurring_statement_email(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.finish_recurring_statement_email(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.configure_recurring_statements(uuid,boolean,date) to service_role;
grant execute on function public.reserve_recurring_statement(uuid,uuid,date,date) to service_role;
grant execute on function public.claim_recurring_statement_email(uuid,uuid) to service_role;
grant execute on function public.prepare_recurring_statement_email(uuid,uuid,uuid,jsonb) to service_role;
grant execute on function public.finish_recurring_statement_email(uuid,uuid,uuid,text,text,text) to service_role;
