-- Preço do sistema antigo (só para consulta; nunca entra na faturação nem no saldo).
ALTER TABLE public.legacy_shipments
  ADD COLUMN IF NOT EXISTS transport_price numeric,
  ADD COLUMN IF NOT EXISTS fees_price numeric,
  ADD COLUMN IF NOT EXISTS fuel_price numeric,
  ADD COLUMN IF NOT EXISTS fuel_pct numeric,
  ADD COLUMN IF NOT EXISTS total_net numeric,
  ADD COLUMN IF NOT EXISTS vat_pct numeric,
  ADD COLUMN IF NOT EXISTS invoice text;
