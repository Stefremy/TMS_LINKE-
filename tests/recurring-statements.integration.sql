-- Run in a transaction together with the migration, ALWAYS ending in ROLLBACK.
-- All records below are fictional, isolated under newly generated test tenants.
do $$
declare
  tenant uuid := gen_random_uuid(); foreign_tenant uuid := gen_random_uuid();
  client uuid := gen_random_uuid(); foreign_client uuid := gen_random_uuid();
  beginning date := (now() at time zone 'Europe/Lisbon')::date - 100;
  ending date;
  first_ship uuid; last_ship uuid; billed_ship uuid;
  result jsonb; second_result jsonb; details jsonb; claim jsonb; token uuid; cycle uuid;
  fixture_payload jsonb := '{"to":"test@example.invalid","html":"test","attachments":[]}'::jsonb;
  days integer;
begin
  insert into public.tenants(id,name) values(tenant,'ROLLBACK TEST recurring statements'),(foreign_tenant,'ROLLBACK TEST foreign');
  insert into public.clients(id,tenant_id,name,created_at) values
    (client,tenant,'Fictional current account',beginning), (foreign_client,foreign_tenant,'Foreign fixture',beginning);
  insert into public.recurring_statement_settings(tenant_id,enabled,anchor_date) values(tenant,true,beginning);
  insert into public.audit_log(tenant_id,action,details) values(tenant,'client_data',jsonb_build_object(
    'id',client,'short_name','Fictional current account','billing_type','conta_corrente','payment_terms','A 7 dias','created_at',beginning));
  ending := beginning+7;
  insert into public.shipments(tenant_id,client_id,tracking_number,status,sender_name,sender_address,recipient_name,recipient_address,service_type,sell_price,created_at)
    values(tenant,client,'TEST-START','pendente','Test','Test','Test','Test','Test',3.91,beginning::timestamp at time zone 'Europe/Lisbon') returning id into first_ship;
  insert into public.shipments(tenant_id,client_id,tracking_number,status,sender_name,sender_address,recipient_name,recipient_address,service_type,sell_price,created_at)
    values(tenant,client,'TEST-LAST','pendente','Test','Test','Test','Test','Test',4.50,(ending::timestamp at time zone 'Europe/Lisbon')-interval '1 microsecond') returning id into last_ship;
  insert into public.shipments(tenant_id,client_id,tracking_number,status,sender_name,sender_address,recipient_name,recipient_address,service_type,sell_price,created_at)
    values(tenant,client,'TEST-BILLED','pendente','Test','Test','Test','Test','Test',50,(beginning+1)::timestamp at time zone 'Europe/Lisbon') returning id into billed_ship;
  insert into public.audit_log(tenant_id,action,details) values(tenant,'billing_statement',jsonb_build_object(
    'client_id',client,'moloni_document_id','TEST-NOT-A-REAL-INVOICE','shipment_ids',jsonb_build_array(billed_ship)));
  insert into public.shipments(tenant_id,client_id,tracking_number,status,sender_name,sender_address,recipient_name,recipient_address,service_type,sell_price,created_at) values
    (tenant,client,'TEST-CANCELLED','cancelado','Test','Test','Test','Test','Test',50,beginning+1),
    (tenant,client,'TEST-DRAFT','rascunho','Test','Test','Test','Test','Test',50,beginning+1),
    (tenant,client,'TEST-OLD','pendente','Test','Test','Test','Test','Test',50,(beginning::timestamp at time zone 'Europe/Lisbon')-interval '1 second'),
    (tenant,client,'TEST-NEXT','pendente','Test','Test','Test','Test','Test',50,ending::timestamp at time zone 'Europe/Lisbon'),
    (foreign_tenant,foreign_client,'TEST-FOREIGN','pendente','Test','Test','Test','Test','Test',50,beginning+1);
  result := public.reserve_recurring_statement(tenant,client,beginning,ending);
  if result->>'statement_id' is null then raise exception 'No statement was reserved: %',result; end if;
  cycle := (result->>'id')::uuid;
  select a.details into details from public.audit_log a where a.id=cycle;
  if (details->>'shipments_count')::integer<>2 or (details->>'total_value')::numeric<>8.41 then raise exception 'Wrong period selection/totals: %',details; end if;
  if not (details->'shipment_ids' ? first_ship::text) or not (details->'shipment_ids' ? last_ship::text) then raise exception 'Boundary shipments missing'; end if;
  if exists(select 1 from public.shipments s where s.tenant_id=tenant and coalesce(to_jsonb(s)->>'billing_statement_id','')<>'') then raise exception 'Statement marked a shipment billed'; end if;
  if (select count(*) from public.audit_log a where a.tenant_id=tenant and a.action='billing_statement')<>1 then raise exception 'Unexpected invoice mutation'; end if;
  second_result := public.reserve_recurring_statement(tenant,client,beginning,ending);
  if second_result->>'skipped' <> 'already_closed_or_stale' then raise exception 'Duplicate period not rejected'; end if;
  second_result := public.reserve_recurring_statement(tenant,client,beginning+1,ending+1);
  if second_result->>'skipped' <> 'already_closed_or_stale' then raise exception 'Overlapping period not rejected'; end if;
  claim := public.claim_recurring_statement_email(tenant,cycle);
  token := (claim->>'lease_token')::uuid;
  if token is null then raise exception 'No delivery lease'; end if;
  if public.claim_recurring_statement_email(tenant,cycle) is not null then raise exception 'Concurrent email lease allowed'; end if;
  if not public.prepare_recurring_statement_email(tenant,cycle,token,fixture_payload) then raise exception 'Payload not saved'; end if;
  if public.finish_recurring_statement_email(foreign_tenant,cycle,token,'sent','fake',null) then raise exception 'Foreign company updated delivery'; end if;
  if not public.finish_recurring_statement_email(tenant,cycle,token,'failed',null,'Simulated outage') then raise exception 'Failure not recorded'; end if;
  update public.recurring_statement_cycles set next_attempt_at=now()-interval '1 minute' where id=cycle;
  claim := public.claim_recurring_statement_email(tenant,cycle);
  if claim->'email_payload'<>fixture_payload then raise exception 'Retry payload changed'; end if;
  if not public.finish_recurring_statement_email(tenant,cycle,(claim->>'lease_token')::uuid,'sent','fake-provider-ack',null) then raise exception 'Acknowledgement not recorded'; end if;
  if public.claim_recurring_statement_email(tenant,cycle) is not null then raise exception 'Sent email can be resent'; end if;
  update public.recurring_statement_cycles set delivery_status='processing',lease_until=now()-interval '1 minute',first_attempt_at=now()-interval '25 hours' where id=cycle;
  if public.claim_recurring_statement_email(tenant,cycle) is not null then raise exception 'Unknown old delivery was retried'; end if;
  if not exists(select 1 from public.recurring_statement_cycles where id=cycle and delivery_status='review_required') then raise exception 'Old delivery not flagged'; end if;
  if has_function_privilege('anon','public.reserve_recurring_statement(uuid,uuid,date,date)','EXECUTE') then raise exception 'Anonymous role can create statements'; end if;
  if has_function_privilege('authenticated','public.claim_recurring_statement_email(uuid,uuid)','EXECUTE') then raise exception 'Browser role can claim emails'; end if;
  if has_table_privilege('authenticated','public.recurring_statement_cycles','SELECT') then raise exception 'Browser role can read email payloads'; end if;
  -- Every allowed cadence, including empty periods, advances exactly once.
  foreach days in array array[1,7,15,30,45,60,90] loop
    client := gen_random_uuid();
    insert into public.clients(id,tenant_id,name,created_at) values(client,tenant,'Cadence fixture',beginning);
    insert into public.audit_log(tenant_id,action,details) values(tenant,'client_data',jsonb_build_object('id',client,'short_name','Cadence fixture','billing_type','conta_corrente','payment_terms',case when days=1 then 'Pronto Pagamento' else 'A '||days||' dias' end,'created_at',beginning));
    result := public.reserve_recurring_statement(tenant,client,beginning,beginning+days);
    if coalesce((result->>'empty')::boolean,false)<>true then raise exception 'Empty cadence did not close: %',days; end if;
  end loop;
  -- A switch to current account after activation excludes the prepaid interval, even after older cycles.
  client := gen_random_uuid();
  insert into public.clients(id,tenant_id,name,created_at) values(client,tenant,'Mode transition fixture',beginning);
  insert into public.audit_log(tenant_id,action,details,created_at) values
    (tenant,'client_data',jsonb_build_object('id',client,'billing_type','pay_as_you_go'),beginning),
    (tenant,'client_data',jsonb_build_object('id',client,'billing_type','conta_corrente','payment_terms','A 7 dias','created_at',beginning),beginning+10),
    (tenant,'client_data',jsonb_build_object('id',client,'billing_type','conta_corrente','payment_terms','A 7 dias','created_at',beginning),beginning+11);
  result := public.reserve_recurring_statement(tenant,client,beginning,beginning+7);
  if result->>'skipped'<>'already_closed_or_stale' then raise exception 'Prepaid interval included'; end if;
  result := public.reserve_recurring_statement(tenant,client,beginning+10,beginning+17);
  if coalesce((result->>'empty')::boolean,false)<>true then raise exception 'Mode transition failed: %',result; end if;
  -- The latest billing mode wins over historical current-account profiles.
  insert into public.audit_log(tenant_id,action,details,created_at) values(tenant,'client_data',jsonb_build_object('id',client,'billing_type','pay_as_you_go'),now()+interval '1 second');
  result := public.reserve_recurring_statement(tenant,client,beginning+90,beginning+180);
  if result->>'skipped'<>'ineligible' then raise exception 'Pay as You Go was not excluded'; end if;
  client := gen_random_uuid();
  insert into public.clients(id,tenant_id,name,created_at) values(client,tenant,'Future period fixture',now());
  insert into public.audit_log(tenant_id,action,details) values(tenant,'client_data',jsonb_build_object('id',client,'billing_type','conta_corrente','payment_terms','A 7 dias','created_at',now()));
  begin
    perform public.reserve_recurring_statement(tenant,client,(now() at time zone 'Europe/Lisbon')::date,(now() at time zone 'Europe/Lisbon')::date+7);
    raise exception 'TEST FAIL: future period accepted';
  exception when others then
    if sqlerrm like 'TEST FAIL:%' then raise; end if;
    if sqlerrm not like 'O período ainda%' then raise; end if;
  end;
  update public.recurring_statement_settings set enabled=false where tenant_id=tenant;
  result := public.reserve_recurring_statement(tenant,client,beginning,beginning+7);
  if result->>'skipped'<>'disabled' then raise exception 'Suspended automation processed a period'; end if;
end $$;
select 'PASS: boundaries, totals, tenant isolation, all cadences, duplicate periods, email leases, retry recovery, unknown delivery and permissions' as test_result;
