-- P01: only the trusted backend may credit a client balance.
-- Keep the function body and existing balances unchanged.
begin;

revoke execute on function public.increment_client_balance(uuid, numeric)
  from public, anon, authenticated;
grant execute on function public.increment_client_balance(uuid, numeric)
  to service_role;

-- Fail atomically if inherited permissions still allow untrusted callers,
-- or if the administrative Stripe webhook would lose access.
do $$
begin
  if has_function_privilege('anon', 'public.increment_client_balance(uuid,numeric)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.increment_client_balance(uuid,numeric)', 'EXECUTE') then
    raise exception 'Public balance function execution is still permitted';
  end if;
  if not has_function_privilege('service_role', 'public.increment_client_balance(uuid,numeric)', 'EXECUTE') then
    raise exception 'Administrative balance function execution is unavailable';
  end if;
end;
$$;

commit;
