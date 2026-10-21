-- Auditoria de isolamento: APENAS LEITURA DE METADADOS.
-- Não executa RPCs de saldo nem lê registos de clientes, envios ou faturas.
-- Não altera grants, políticas ou dados.
-- Consultas equivalentes executadas em 21/10/2026; resultados em
-- docs/CLIENT_ISOLATION_SUPABASE_2026-10-21.md.

-- 1. Funções sensíveis: contexto de execução e permissões efetivas.
select
  n.nspname as schema_name,
  p.oid::regprocedure::text as function_signature,
  pg_get_userbyid(p.proowner) as function_owner,
  p.prosecdef as security_definer,
  p.proconfig as function_settings,
  case when to_regrole('anon') is not null
    then has_function_privilege('anon', p.oid, 'EXECUTE') end as anon_can_execute,
  case when to_regrole('authenticated') is not null
    then has_function_privilege('authenticated', p.oid, 'EXECUTE') end as authenticated_can_execute,
  case when to_regrole('service_role') is not null
    then has_function_privilege('service_role', p.oid, 'EXECUTE') end as service_role_can_execute,
  p.proacl::text as explicit_acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'increment_client_balance', 'shipment_label_by_id',
    'claim_billing_shipments', 'configure_recurring_statements',
    'reserve_recurring_statement', 'claim_recurring_invoice'
  )
order by p.proname, p.oid::regprocedure::text;

-- 2. Estado RLS e privilégios das tabelas relevantes.
-- Um privilégio de tabela não substitui a avaliação das políticas RLS.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  case when to_regrole('anon') is not null
    then has_table_privilege('anon', c.oid, 'SELECT') end as anon_can_select,
  case when to_regrole('authenticated') is not null
    then has_table_privilege('authenticated', c.oid, 'SELECT') end as authenticated_can_select,
  case when to_regrole('authenticated') is not null
    then has_table_privilege('authenticated', c.oid, 'INSERT') end as authenticated_can_insert,
  case when to_regrole('authenticated') is not null
    then has_table_privilege('authenticated', c.oid, 'UPDATE') end as authenticated_can_update,
  case when to_regrole('authenticated') is not null
    then has_table_privilege('authenticated', c.oid, 'DELETE') end as authenticated_can_delete
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p')
  and c.relname in (
    'clients', 'client_users', 'shipments', 'packages', 'tracking_events',
    'audit_log', 'client_transactions', 'billing_statements',
    'servicos_linke', 'recurring_statement_cycles'
  )
order by c.relname;

-- 3. Políticas efetivamente presentes.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'clients', 'client_users', 'shipments', 'packages', 'tracking_events',
    'audit_log', 'client_transactions', 'billing_statements',
    'servicos_linke', 'recurring_statement_cycles'
  )
order by tablename, policyname;

-- 4. Confirmar como os auxiliares usados pelas políticas obtêm o âmbito.
select n.nspname as schema_name, p.proname, pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'auth' and p.proname in ('role', 'client_id')
order by p.proname;

-- 5. Confirmar o corpo publicado da função sensível, sem a executar.
select pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'increment_client_balance';
