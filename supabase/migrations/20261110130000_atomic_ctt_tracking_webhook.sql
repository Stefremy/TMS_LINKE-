-- R-01: Transactional, idempotent and chronologically ordered CTT tracking webhook persistence.
begin;

create or replace function public.apply_ctt_tracking_webhook_event(
  p_shipment_id uuid,
  p_tenant_id uuid,
  p_event_code text,
  p_description text,
  p_target_status public.shipment_status,
  p_event_timestamp timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_status public.shipment_status;
  v_inserted_event_id uuid;
  v_has_newer_event boolean := false;
  v_is_terminal boolean := false;
  v_status_updated boolean := false;
begin
  select s.status
    into v_current_status
    from public.shipments s
   where s.id = p_shipment_id
     and s.tenant_id = p_tenant_id
     for update;

  if not found then
    return jsonb_build_object(
      'applied', false,
      'duplicate', false,
      'status_updated', false,
      'reason', 'not_found'
    );
  end if;

  insert into public.tracking_events (
    tenant_id,
    shipment_id,
    event_code,
    description,
    timestamp,
    created_at
  )
  values (
    p_tenant_id,
    p_shipment_id,
    p_event_code,
    p_description,
    p_event_timestamp,
    now()
  )
  on conflict (shipment_id, event_code, timestamp) do nothing
  returning id into v_inserted_event_id;

  if v_inserted_event_id is null then
    return jsonb_build_object(
      'applied', false,
      'duplicate', true,
      'status_updated', false,
      'status', v_current_status::text
    );
  end if;

  v_is_terminal := v_current_status in ('entregue', 'devolvido', 'cancelado');

  select exists (
    select 1
      from public.tracking_events te
     where te.shipment_id = p_shipment_id
       and te.id <> v_inserted_event_id
       and te.timestamp > p_event_timestamp
  )
  into v_has_newer_event;

  if not v_is_terminal and not v_has_newer_event then
    update public.shipments
       set status = p_target_status,
           ops_substatus = lower(left(p_event_code, 50)),
           updated_at = now()
     where id = p_shipment_id;

    v_status_updated := true;
  end if;

  return jsonb_build_object(
    'applied', true,
    'duplicate', false,
    'status_updated', v_status_updated,
    'event_id', v_inserted_event_id,
    'status', case when v_status_updated then p_target_status::text else v_current_status::text end
  );
end;
$$;

revoke all on function public.apply_ctt_tracking_webhook_event(uuid, uuid, text, text, public.shipment_status, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_ctt_tracking_webhook_event(uuid, uuid, text, text, public.shipment_status, timestamptz)
  to service_role;

do $$
begin
  if has_function_privilege('anon', 'public.apply_ctt_tracking_webhook_event(uuid,uuid,text,text,public.shipment_status,timestamptz)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.apply_ctt_tracking_webhook_event(uuid,uuid,text,text,public.shipment_status,timestamptz)', 'EXECUTE') then
    raise exception 'Public execution of apply_ctt_tracking_webhook_event is still permitted';
  end if;
  if not has_function_privilege('service_role', 'public.apply_ctt_tracking_webhook_event(uuid,uuid,text,text,public.shipment_status,timestamptz)', 'EXECUTE') then
    raise exception 'Service role execution of apply_ctt_tracking_webhook_event is unavailable';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;

