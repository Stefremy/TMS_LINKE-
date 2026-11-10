-- S-05: Harden sync_whatsapp_logs_sequence() search_path and restrict execution to service_role.
begin;

drop function if exists public.sync_whatsapp_logs_sequence();

create or replace function public.sync_whatsapp_logs_sequence()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform setval(
    pg_get_serial_sequence('public.whatsapp_logs', 'id'),
    coalesce((select max(id) from public.whatsapp_logs), 1),
    true
  );
end;
$$;

revoke all on function public.sync_whatsapp_logs_sequence() from public, anon, authenticated;
grant execute on function public.sync_whatsapp_logs_sequence() to service_role;

do $$
begin
  if has_function_privilege('anon', 'public.sync_whatsapp_logs_sequence()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.sync_whatsapp_logs_sequence()', 'EXECUTE') then
    raise exception 'Public execution of sync_whatsapp_logs_sequence is still permitted';
  end if;
  if not has_function_privilege('service_role', 'public.sync_whatsapp_logs_sequence()', 'EXECUTE') then
    raise exception 'Service role execution of sync_whatsapp_logs_sequence is unavailable';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;

