-- Extratos de Faturação (TMS -> Moloni)
CREATE TABLE IF NOT EXISTS public.billing_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    client_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    statement_number TEXT NOT NULL, -- Ex: EXT-2026/09
    moloni_document_id TEXT, -- ID do documento gerado no Moloni
    moloni_document_pdf TEXT, -- Link ou base64 do PDF
    total_value NUMERIC NOT NULL DEFAULT 0,
    shipments_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar FK de shipments para o extrato de faturação
ALTER TABLE public.shipments 
ADD COLUMN billing_statement_id UUID REFERENCES public.billing_statements(id) ON DELETE SET NULL;
