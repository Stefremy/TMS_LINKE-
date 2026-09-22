ALTER TABLE "public"."shipments" 
ADD COLUMN IF NOT EXISTS "weight_kg" numeric DEFAULT 1,
ADD COLUMN IF NOT EXISTS "base_price" numeric,
ADD COLUMN IF NOT EXISTS "fuel_tax_amount" numeric,
ADD COLUMN IF NOT EXISTS "tier_label" text;
