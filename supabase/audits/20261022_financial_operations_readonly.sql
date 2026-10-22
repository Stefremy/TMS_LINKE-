-- ADMINISTRATIVE, READ ONLY. Run after 20261022180000_atomic_wallet_operations.sql.
-- Counts identify work to investigate; they do NOT prove missing credit or authorize replay.
BEGIN READ ONLY;

SELECT p.proname, p.oid::regprocedure::text AS signature,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') AS backend_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
  ('increment_client_balance','settle_stripe_topup','client_wallet_snapshot',
   'reserve_shipment_wallet','transition_wallet_reservation','save_client_financial_profile');

SELECT c.relname,c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='wallet_reservations';

SELECT status,credited_at IS NOT NULL AS fulfillment_recorded,count(*) AS transactions
FROM public.client_transactions GROUP BY status,credited_at IS NOT NULL ORDER BY status;

SELECT state,count(*) AS reservations,min(created_at) AS oldest_operation
FROM public.wallet_reservations GROUP BY state ORDER BY state;

SELECT details->>'state' AS state,count(*) AS receipt_operations
FROM public.audit_log WHERE action='receipt_operation' GROUP BY details->>'state';

SELECT count(*) AS financial_operations_still_locked
FROM public.audit_log WHERE action='invoice_financial_lock';

SELECT count(*) AS historical_shipment_snapshots_without_billing_model
FROM public.audit_log WHERE action='shipment_data' AND details->>'billing_type' IS NULL;

ROLLBACK;
