-- Add carrier tracking number column to shipments
-- This stores the physical carrier tracking number (e.g. CTT: EQ418727568PT)
-- separately from the internal Linke reference (e.g. LTK1539160)

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS carrier_tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS carrier_code TEXT DEFAULT 'ctt_expresso';

-- Index for fast lookup by carrier tracking number
CREATE INDEX IF NOT EXISTS idx_shipments_carrier_tracking 
  ON shipments(carrier_tracking_number)
  WHERE carrier_tracking_number IS NOT NULL;

COMMENT ON COLUMN shipments.carrier_tracking_number IS 'Physical carrier tracking number (e.g. EQ418727568PT for CTT)';
COMMENT ON COLUMN shipments.carrier_code IS 'Carrier identifier (e.g. ctt_expresso, dpd, gls)';
