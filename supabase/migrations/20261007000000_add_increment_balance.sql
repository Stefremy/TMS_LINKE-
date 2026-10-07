-- Increment client credit limit atomically
CREATE OR REPLACE FUNCTION increment_client_balance(client_id uuid, amount numeric)
RETURNS void AS $$
BEGIN
  UPDATE clients
  SET credit_limit = COALESCE(credit_limit, 0) + amount
  WHERE id = client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
