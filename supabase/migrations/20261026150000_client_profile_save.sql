-- Publish the existing client-save RPC independently of the wallet rollout.
-- Same contract and function body as 20261022180000_atomic_wallet_operations.sql.
-- This migration does not execute the function or change any client/balance rows.
BEGIN;

CREATE OR REPLACE FUNCTION public.save_client_financial_profile(p_tenant uuid,p_client uuid,p_details jsonb,p_expected_credit numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE prior public.audit_log; new_id uuid;
BEGIN
  PERFORM 1 FROM public.clients WHERE id=p_client AND tenant_id=p_tenant FOR UPDATE;
  IF NOT FOUND OR p_details->>'id' IS DISTINCT FROM p_client::text THEN RAISE EXCEPTION 'Client binding mismatch'; END IF;
  SELECT * INTO prior FROM public.audit_log WHERE tenant_id=p_tenant AND action='client_data'
    AND details->>'id'=p_client::text ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
  IF (prior.details->>'credit_limit')::numeric IS DISTINCT FROM p_expected_credit THEN
    RAISE EXCEPTION 'Balance changed; refresh the client before saving';
  END IF;
  IF (p_details->>'credit_limit') IS NULL OR (p_details->>'credit_limit')::numeric::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'Invalid credit';
  END IF;
  INSERT INTO public.audit_log(tenant_id,action,details) VALUES(p_tenant,'client_data',p_details) RETURNING id INTO new_id;
  DELETE FROM public.audit_log WHERE tenant_id=p_tenant AND action='client_data' AND details->>'id'=p_client::text
    AND id<>new_id;
END $$;

REVOKE ALL ON FUNCTION public.save_client_financial_profile(uuid,uuid,jsonb,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_client_financial_profile(uuid,uuid,jsonb,numeric) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
