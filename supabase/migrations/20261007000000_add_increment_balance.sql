-- Increment client credit limit atomically
CREATE OR REPLACE FUNCTION increment_client_balance(client_id uuid, amount numeric)
RETURNS void AS $$
BEGIN
  UPDATE audit_log
  SET details = jsonb_set(
    details,
    '{credit_limit}',
    to_jsonb(COALESCE((details->>'credit_limit')::numeric, 0) + amount)
  )
  WHERE action = 'client_data' AND details->>'id' = client_id::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
