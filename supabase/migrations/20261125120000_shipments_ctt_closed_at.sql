-- O fecho CTT (certificado de aceitação) era guardado em ops_substatus = 'manifesto_fechado', mas o
-- tracking CTT escreve o último código de evento (ex.: 'emo') no mesmo campo e apagava a indicação.
-- Passa a ter coluna própria, que o tracking nunca toca.
BEGIN;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS ctt_closed_at timestamptz;

-- Recuperar fechos já confirmados a partir do arquivo de manifestos.
UPDATE public.shipments s SET ctt_closed_at = m.closed_at
FROM (
  SELECT a.tenant_id, e.id::uuid AS id, min(a.created_at) AS closed_at
  FROM public.audit_log a
  CROSS JOIN LATERAL jsonb_array_elements_text(a.details->'shipment_ids') AS e(id)
  WHERE a.action = 'manifest_closed'
    AND jsonb_typeof(a.details->'shipment_ids') = 'array'
    AND e.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  GROUP BY a.tenant_id, e.id
) m
WHERE s.id = m.id AND s.tenant_id = m.tenant_id AND s.ctt_closed_at IS NULL;

-- Fechos que ainda têm a indicação antiga (sem registo no arquivo).
UPDATE public.shipments SET ctt_closed_at = coalesce(updated_at, created_at)
WHERE ctt_closed_at IS NULL AND ops_substatus IN ('manifesto_fechado', 'expedido');
COMMIT;
