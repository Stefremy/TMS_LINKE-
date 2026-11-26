-- Histórico de envios importado da plataforma antiga, só para consulta pelo cliente.
-- Tabela própria de propósito: faturação, saldo, notificações, tracking e manifestos leem só public.shipments.
BEGIN;
CREATE TABLE IF NOT EXISTS public.legacy_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  legacy_trk text NOT NULL,
  carrier_tracking_number text,
  reference text,
  service text,
  recipient_name text,
  recipient_address text,
  recipient_zip text,
  recipient_city text,
  recipient_country text,
  recipient_phone text,
  recipient_email text,
  volumes integer,
  weight_kg numeric,
  status text,
  status_at timestamptz,
  receiver_name text,
  shipped_at timestamptz,
  source_file text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, legacy_trk)
);
CREATE INDEX IF NOT EXISTS legacy_shipments_client_idx ON public.legacy_shipments (tenant_id, client_id, shipped_at DESC);
-- Lido só no servidor (service role), sempre filtrado pelo cliente da sessão.
ALTER TABLE public.legacy_shipments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.legacy_shipments FROM anon, authenticated;
COMMIT;
