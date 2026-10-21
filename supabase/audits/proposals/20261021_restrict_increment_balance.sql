-- Proposta original preservada para referência.
-- Autorizada e aplicada em 21/10/2026 através da migração canónica:
-- supabase/migrations/20261021120000_restrict_increment_client_balance.sql
-- P01: remover execução pública da função de saldo; manter o webhook administrativo.
-- Não executa a função, não altera o seu corpo e não modifica saldos.

begin;

revoke execute on function public.increment_client_balance(uuid, numeric)
  from public, anon, authenticated;
grant execute on function public.increment_client_balance(uuid, numeric)
  to service_role;

-- Se os privilégios efetivos não corresponderem ao esperado, abortar a transação.
do $$
begin
  if has_function_privilege('anon', 'public.increment_client_balance(uuid,numeric)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.increment_client_balance(uuid,numeric)', 'EXECUTE') then
    raise exception 'A execução pública da função de saldo continua permitida';
  end if;
  if not has_function_privilege('service_role', 'public.increment_client_balance(uuid,numeric)', 'EXECUTE') then
    raise exception 'A execução administrativa da função de saldo ficou indisponível';
  end if;
end;
$$;

commit;
