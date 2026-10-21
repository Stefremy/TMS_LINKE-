-- Read-only P01 regression check. Never invokes increment_client_balance.
select
  p.oid::regprocedure::text as function_signature,
  p.prosecdef as security_definer,
  exists (
    select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) as public_can_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute,
  md5(pg_get_functiondef(p.oid)) as definition_hash
from pg_proc p
where p.oid = 'public.increment_client_balance(uuid,numeric)'::regprocedure;
