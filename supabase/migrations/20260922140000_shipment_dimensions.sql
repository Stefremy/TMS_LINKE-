ALTER TABLE "public"."shipments"
ADD COLUMN IF NOT EXISTS "length_cm" numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS "width_cm" numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS "height_cm" numeric DEFAULT 0;
