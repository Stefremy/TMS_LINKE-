-- Adicionar colunas para suporte de Taxas e Serviços Especiais
ALTER TABLE "public"."shipments" 
ADD COLUMN IF NOT EXISTS "special_fees_amount" numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS "special_fees_description" text,
ADD COLUMN IF NOT EXISTS "cod_value" numeric DEFAULT 0;
