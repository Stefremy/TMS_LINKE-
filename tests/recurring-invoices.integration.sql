-- Fictional records only, run with migration inside BEGIN ... ROLLBACK.
do $$
declare tenant uuid:=gen_random_uuid(); client uuid; ship uuid; result jsonb; cycle uuid; claim jsonb; token uuid;
  beginning date:=(now() at time zone 'Europe/Lisbon')::date-10; scenario integer; stmt jsonb;
begin
  insert into public.tenants(id,name) values(tenant,'ROLLBACK invoice automation test');
  insert into public.recurring_statement_settings(tenant_id,enabled,anchor_date) values(tenant,true,beginning);
  for scenario in 1..4 loop
    client:=gen_random_uuid();
    insert into public.clients(id,tenant_id,name,created_at) values(client,tenant,'Fictional invoice client',beginning);
    insert into public.audit_log(tenant_id,action,details) values(tenant,'client_data',jsonb_build_object('id',client,'billing_type','conta_corrente','payment_terms','A 7 dias','created_at',beginning));
    insert into public.shipments(tenant_id,client_id,tracking_number,status,sender_name,sender_address,recipient_name,recipient_address,service_type,sell_price,created_at)
      values(tenant,client,'TEST-AUTO-'||scenario,'pendente','Test','Test','Test','Test','Test',3.91,beginning) returning id into ship;
    result:=public.reserve_recurring_statement(tenant,client,beginning,beginning+7);
    cycle:=(result->>'id')::uuid;
    if cycle is null then raise exception 'No period: %',result; end if;
    claim:=public.claim_recurring_invoice(tenant,cycle); token:=(claim->>'invoice_token')::uuid;
    if token is null then raise exception 'No invoice token'; end if;
    if public.claim_recurring_invoice(tenant,cycle) is not null then raise exception 'Concurrent worker admitted'; end if;
    if public.arm_recurring_invoice(tenant,cycle,null,'{}') then raise exception 'Null token admitted'; end if;
    if scenario=4 then
      perform public.claim_billing_shipments(tenant,client,gen_random_uuid(),array[ship]);
      begin
        perform public.arm_recurring_invoice(tenant,cycle,token,'{}');
        raise exception 'TEST FAIL: automatic emission can duplicate manual emission';
      exception when others then if sqlerrm like 'TEST FAIL:%' then raise; end if; end;
      continue;
    end if;
    if scenario=3 then
      perform public.fail_recurring_invoice(tenant,cycle,token,'Missing fiscal information');
      if not exists(select 1 from public.recurring_statement_cycles where id=cycle and invoice_status='blocked') then raise exception 'Preflight not blocked'; end if;
      if exists(select 1 from public.billing_emission_claims where tenant_id=tenant and shipment_id=ship) then raise exception 'Preflight claimed shipment'; end if;
      continue;
    end if;
    if not public.arm_recurring_invoice(tenant,cycle,token,'{"status":1,"your_reference":"FICTIONAL"}') then raise exception 'Could not arm invoice'; end if;
    begin
      perform public.claim_billing_shipments(tenant,client,gen_random_uuid(),array[ship]);
      raise exception 'TEST FAIL: manual duplicate admitted';
    exception when others then if sqlerrm like 'TEST FAIL:%' then raise; end if; end;
    if scenario=2 then
      perform public.fail_recurring_invoice(tenant,cycle,token,'Unknown network outcome');
      if public.claim_recurring_invoice(tenant,cycle) is not null then raise exception 'Uncertain invoice retried'; end if;
      if not exists(select 1 from public.recurring_statement_cycles where id=cycle and invoice_status='review_required') then raise exception 'Unknown result not flagged'; end if;
      continue;
    end if;
    if public.finish_recurring_invoice(tenant,cycle,gen_random_uuid(),123,'FT TEST') then raise exception 'Wrong token admitted'; end if;
    if not public.finish_recurring_invoice(tenant,cycle,token,123,'FT TEST') then raise exception 'Invoice not persisted'; end if;
    select a.details into stmt from public.audit_log a where a.tenant_id=tenant and a.action='billing_statement' and a.details->>'period_statement_id'=cycle::text;
    if stmt->>'status'<>'unpaid' or stmt->>'moloni_document_id'<>'123' or stmt->>'moloni_receipt_id' is not null then raise exception 'Wrong invoice/payment state: %',stmt; end if;
    if (public.claim_recurring_invoice(tenant,cycle)->>'invoice_status')<>'issued' then raise exception 'Issued document not reused'; end if;
    if public.finish_recurring_invoice(tenant,cycle,token,123,'FT TEST') then raise exception 'Duplicate finalization admitted'; end if;
  end loop;
  -- A claim for another client's shipment is rejected before creating any reservation.
  begin
    perform public.claim_billing_shipments(tenant,gen_random_uuid(),gen_random_uuid(),array[ship]);
    raise exception 'TEST FAIL: foreign client shipment claimed';
  exception when others then if sqlerrm like 'TEST FAIL:%' then raise; end if; end;
  if has_function_privilege('authenticated','public.arm_recurring_invoice(uuid,uuid,uuid,jsonb)','EXECUTE') then raise exception 'Browser role can arm invoices'; end if;
  if has_table_privilege('authenticated','public.billing_emission_claims','SELECT') then raise exception 'Browser role can read reservations'; end if;
end $$;
select 'PASS: single invoice, concurrent claims, manual/automatic conflicts, unknown responses, tenant/client ownership, payment state and permissions' as test_result;

do $$
declare tenant uuid:=gen_random_uuid(); client uuid:=gen_random_uuid(); old_profile uuid; current_profile uuid;
  beginning date:=(now() at time zone 'Europe/Lisbon')::date-30; doc jsonb; result jsonb;
begin
  insert into public.tenants(id,name) values(tenant,'ROLLBACK replaced profile epoch');
  insert into public.clients(id,tenant_id,name,created_at) values(client,tenant,'Fictional switched client',beginning);
  insert into public.recurring_statement_settings(tenant_id,enabled,anchor_date) values(tenant,true,beginning);
  insert into public.audit_log(tenant_id,action,details,created_at) values(tenant,'client_data',jsonb_build_object('id',client,'billing_type','pay_as_you_go','created_at',beginning),beginning) returning id into old_profile;
  insert into public.audit_log(tenant_id,action,details,created_at) values(tenant,'client_data',jsonb_build_object('id',client,'billing_type','conta_corrente','payment_terms','A 7 dias','created_at',beginning),beginning+10) returning id into current_profile;
  delete from public.audit_log where tenant_id=tenant and id=old_profile;
  old_profile:=current_profile;
  insert into public.audit_log(tenant_id,action,details,created_at) values(tenant,'client_data',jsonb_build_object('id',client,'billing_type','conta_corrente','payment_terms','A 7 dias','created_at',beginning),beginning+15) returning details into doc;
  delete from public.audit_log where tenant_id=tenant and id=old_profile;
  if doc->>'recurring_since'<>(beginning+10)::text then raise exception 'Eligibility epoch lost on profile replacement: %',doc; end if;
  result:=public.reserve_recurring_statement(tenant,client,beginning,beginning+7);
  if result->>'skipped'<>'already_closed_or_stale' then raise exception 'Prepaid interval included after profile deletion'; end if;
  result:=public.reserve_recurring_statement(tenant,client,beginning+10,beginning+17);
  if coalesce((result->>'empty')::boolean,false)<>true then raise exception 'Preserved epoch not used by period reservation: %',result; end if;
end $$;
select 'PASS: eligibility survives replacing client profiles and deleting previous snapshots' as profile_epoch_test;
