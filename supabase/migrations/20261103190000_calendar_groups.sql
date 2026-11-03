-- REVIEW BEFORE APPLYING. Additive migration; no existing events are deleted.
BEGIN;
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS group_id uuid,
  ADD COLUMN IF NOT EXISTS all_day boolean,
  ADD COLUMN IF NOT EXISTS creator_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipment_tracking_number text;

-- The legacy calendar belonged to the original Linke tenant. Never infer groups
-- from equal titles: two unrelated appointments could have the same text.
UPDATE public.calendar_events SET
  tenant_id = COALESCE(tenant_id, '11111111-1111-1111-1111-111111111111'::uuid),
  group_id = COALESCE(group_id, id),
  all_day = COALESCE(all_day, NULLIF(btrim(time), '') IS NULL),
  updated_at = COALESCE(updated_at, created_at, now());
UPDATE public.calendar_events e SET creator_id = u.id FROM auth.users u
WHERE e.creator_id IS NULL AND lower(e.creator_email) = lower(u.email)
  AND COALESCE(u.raw_app_meta_data->>'tenant_id', '11111111-1111-1111-1111-111111111111') = e.tenant_id::text
  AND u.raw_app_meta_data->>'role' IN ('admin', 'employee');
ALTER TABLE public.calendar_events
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN group_id SET NOT NULL,
  ALTER COLUMN group_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN all_day SET NOT NULL,
  ALTER COLUMN all_day SET DEFAULT true,
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS calendar_events_group_day_idx ON public.calendar_events(tenant_id, group_id, event_date);
CREATE INDEX IF NOT EXISTS calendar_events_tenant_date_idx ON public.calendar_events(tenant_id, event_date);

DROP POLICY IF EXISTS "Allow select all calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "Allow insert calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "Allow update own calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "Allow delete own calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "calendar_staff_read" ON public.calendar_events;
CREATE POLICY calendar_staff_read ON public.calendar_events FOR SELECT TO authenticated USING (
  auth.jwt()->'app_metadata'->>'role' IN ('employee', 'admin')
  AND COALESCE(auth.jwt()->'app_metadata'->>'staff_status', '') <> 'Inativo'
  AND tenant_id::text = COALESCE(auth.jwt()->'app_metadata'->>'tenant_id', '11111111-1111-1111-1111-111111111111')
);
-- Mutations go through authenticated server actions and service-role-only RPCs.
REVOKE INSERT, UPDATE, DELETE ON public.calendar_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.calendar_read_groups(p_tenant uuid, p_start date, p_end date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(g) ORDER BY g.start_date, g.time, g.id), '[]'::jsonb)
  FROM (
    SELECT e.group_id AS id, min(e.event_date) AS start_date, max(e.event_date) AS end_date,
      min(e.title) AS title, min(e.description) AS description, min(e.time) AS time,
      bool_and(e.all_day) AS all_day, min(e.collab_id) AS collab_id,
      min(e.creator_email) AS creator_email, (array_agg(e.creator_id))[1] AS creator_id,
      min(e.shipment_tracking_number) AS shipment_tracking_number, max(e.updated_at) AS updated_at
    FROM public.calendar_events e WHERE e.tenant_id = p_tenant AND e.group_id IN (
      SELECT group_id FROM public.calendar_events WHERE tenant_id = p_tenant AND event_date BETWEEN p_start AND p_end
    ) GROUP BY e.group_id
  ) g;
$$;

CREATE OR REPLACE FUNCTION public.calendar_save_group(
  p_tenant uuid, p_actor uuid, p_email text, p_admin boolean, p_group uuid,
  p_create boolean, p_expected timestamptz, p_event jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_old public.calendar_events%ROWTYPE;
  v_start date := (p_event->>'event_date')::date;
  v_end date := COALESCE(NULLIF(p_event->>'end_date', ''), p_event->>'event_date')::date;
  v_all boolean := COALESCE((p_event->>'all_day')::boolean, true);
  v_time text;
  v_now timestamptz := clock_timestamp();
  v_rows jsonb;
BEGIN
  IF p_actor IS NULL OR p_tenant IS NULL OR p_group IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  IF v_start IS NULL OR v_end IS NULL OR v_end < v_start OR v_end - v_start > 365
    OR length(btrim(COALESCE(p_event->>'title', ''))) NOT BETWEEN 1 AND 160
    OR length(COALESCE(p_event->>'description', '')) > 4000
    OR NULLIF(btrim(p_event->>'collab_id'), '') IS NULL THEN RAISE EXCEPTION 'Dados do evento inválidos.'; END IF;
  IF NOT v_all THEN
    IF COALESCE(p_event->>'time', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      OR (NULLIF(p_event->>'end_time','') IS NOT NULL AND (
        p_event->>'end_time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR p_event->>'end_time' <= p_event->>'time'
      )) THEN RAISE EXCEPTION 'A hora de fim deve ser posterior à hora de início.'; END IF;
    v_time := p_event->>'time';
    IF NULLIF(p_event->>'end_time','') IS NOT NULL THEN v_time := v_time || '–' || (p_event->>'end_time'); END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_group::text, 0));
  SELECT * INTO v_old FROM public.calendar_events WHERE tenant_id = p_tenant AND group_id = p_group LIMIT 1 FOR UPDATE;
  IF p_create THEN
    IF FOUND THEN RAISE EXCEPTION 'O evento já existe.' USING ERRCODE = '40001'; END IF;
  ELSE
    IF NOT FOUND THEN RAISE EXCEPTION 'Evento não encontrado.'; END IF;
    IF NOT COALESCE(p_admin, false) AND NOT COALESCE(v_old.creator_id = p_actor OR (v_old.creator_id IS NULL AND lower(v_old.creator_email) = lower(p_email)), false) THEN
      RAISE EXCEPTION 'Apenas o criador ou um administrador pode alterar este evento.' USING ERRCODE = '42501';
    END IF;
    IF p_expected IS NULL OR EXISTS (SELECT 1 FROM public.calendar_events WHERE tenant_id = p_tenant AND group_id = p_group AND updated_at <> p_expected) THEN
      RAISE EXCEPTION 'O evento foi alterado por outra pessoa. Atualize o calendário.' USING ERRCODE = '40001';
    END IF;
    DELETE FROM public.calendar_events WHERE tenant_id = p_tenant AND group_id = p_group;
  END IF;
  INSERT INTO public.calendar_events(tenant_id, group_id, title, description, time, event_date, collab_id, creator_email, creator_id, all_day, shipment_tracking_number, updated_at, created_at)
  SELECT p_tenant, p_group, btrim(p_event->>'title'), NULLIF(btrim(p_event->>'description'), ''), v_time,
    v_start + day_index, p_event->>'collab_id', CASE WHEN p_create THEN p_email ELSE v_old.creator_email END,
    CASE WHEN p_create THEN p_actor ELSE v_old.creator_id END, v_all, NULLIF(p_event->>'shipment_tracking_number',''), v_now, CASE WHEN p_create THEN v_now ELSE v_old.created_at END
  FROM generate_series(0, v_end - v_start) day_index;
  SELECT jsonb_agg(to_jsonb(e) ORDER BY event_date) INTO v_rows FROM public.calendar_events e WHERE tenant_id = p_tenant AND group_id = p_group;
  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.calendar_delete_group(p_tenant uuid, p_actor uuid, p_email text, p_admin boolean, p_group uuid, p_expected timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_old public.calendar_events%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_group::text, 0));
  SELECT * INTO v_old FROM public.calendar_events WHERE tenant_id = p_tenant AND group_id = p_group LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento não encontrado.'; END IF;
  IF NOT COALESCE(p_admin, false) AND NOT COALESCE(v_old.creator_id = p_actor OR (v_old.creator_id IS NULL AND lower(v_old.creator_email) = lower(p_email)), false) THEN
    RAISE EXCEPTION 'Apenas o criador ou um administrador pode eliminar este evento.' USING ERRCODE = '42501';
  END IF;
  IF p_expected IS NULL OR EXISTS (SELECT 1 FROM public.calendar_events WHERE tenant_id = p_tenant AND group_id = p_group AND updated_at <> p_expected) THEN
    RAISE EXCEPTION 'O evento foi alterado por outra pessoa. Atualize o calendário.' USING ERRCODE = '40001';
  END IF;
  DELETE FROM public.calendar_events WHERE tenant_id = p_tenant AND group_id = p_group;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.calendar_read_groups(uuid,date,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calendar_save_group(uuid,uuid,text,boolean,uuid,boolean,timestamptz,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calendar_delete_group(uuid,uuid,text,boolean,uuid,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calendar_read_groups(uuid,date,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.calendar_save_group(uuid,uuid,text,boolean,uuid,boolean,timestamptz,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.calendar_delete_group(uuid,uuid,text,boolean,uuid,timestamptz) TO service_role;
COMMIT;
