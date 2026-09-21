-- ============================================================
-- MIGRAÇÃO: Faturação de Conta Corrente (Billing Statements)
-- Executa este SQL no Supabase > SQL Editor
-- URL: https://supabase.com/dashboard/project/rcifuhiwemwlatgserva/sql/new
-- ============================================================

-- 1. Tabela de Extratos de Faturação
CREATE TABLE IF NOT EXISTS billing_statements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     TEXT NOT NULL,
  client_id     TEXT NOT NULL,
  statement_number TEXT NOT NULL,
  moloni_document_id TEXT,
  moloni_document_pdf TEXT,
  total_value   NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipments_count INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Adicionar coluna billing_statement_id à tabela de envios
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS billing_statement_id UUID REFERENCES billing_statements(id) ON DELETE SET NULL;

-- 3. (Opcional) Índices para queries rápidas
CREATE INDEX IF NOT EXISTS idx_billing_statements_client_id ON billing_statements(client_id);
CREATE INDEX IF NOT EXISTS idx_shipments_billing_statement_id ON shipments(billing_statement_id);
