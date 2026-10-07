-- Deduplicate existing events by keeping only the oldest for each shipment_id, event_code, timestamp combination
DELETE FROM tracking_events a USING (
    SELECT MIN(id) as id, shipment_id, event_code, timestamp
    FROM tracking_events
    GROUP BY shipment_id, event_code, timestamp
    HAVING COUNT(*) > 1
) b
WHERE a.shipment_id = b.shipment_id 
  AND a.event_code = b.event_code 
  AND a.timestamp = b.timestamp 
  AND a.id <> b.id;

-- Add a unique constraint to prevent race conditions during sync
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracking_events_unique_event 
ON tracking_events (shipment_id, event_code, timestamp);
