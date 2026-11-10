-- Migration: 20261110150000_canonical_colaboradores_table.sql
-- PERF-001: Create canonical colaboradores table to eliminate full historical audit_log replays.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS public.colaboradores (
  id TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL,
  code TEXT,
  name TEXT NOT NULL,
  role TEXT,
  department TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  mobile_phone TEXT,
  nif TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  access_level TEXT NOT NULL DEFAULT 'Operacional',
  agency_location TEXT,
  admission_date TEXT,
  avatar_color TEXT,
  avatar TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  emergency_contact TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS colaboradores_tenant_id_idx
  ON public.colaboradores(tenant_id);

CREATE INDEX IF NOT EXISTS colaboradores_tenant_email_idx
  ON public.colaboradores(tenant_id, lower(email));

CREATE INDEX IF NOT EXISTS colaboradores_tenant_status_idx
  ON public.colaboradores(tenant_id, status);

-- Enable Row Level Security
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

-- Grant permissions to roles
GRANT ALL ON public.colaboradores TO service_role;
GRANT SELECT ON public.colaboradores TO authenticated;

-- Service role has full access
DROP POLICY IF EXISTS "Service role has full access to colaboradores" ON public.colaboradores;
CREATE POLICY "Service role has full access to colaboradores"
  ON public.colaboradores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated staff can SELECT from their own tenant
DROP POLICY IF EXISTS "Staff can read colaboradores of own tenant" ON public.colaboradores;
CREATE POLICY "Staff can read colaboradores of own tenant"
  ON public.colaboradores
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'employee')
    AND tenant_id = ((auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  );

-- Backfill canonical state from latest audit_log events if table is empty
INSERT INTO public.colaboradores (
  id, tenant_id, code, name, role, department, email, phone, mobile_phone,
  nif, status, access_level, agency_location, admission_date, avatar_color,
  avatar, permissions, emergency_contact, notes, created_at, updated_at
)
SELECT DISTINCT ON (details->>'id')
  details->>'id',
  tenant_id,
  details->>'code',
  COALESCE(details->>'name', 'Colaborador'),
  details->>'role',
  details->>'department',
  lower(COALESCE(details->>'email', '')),
  details->>'phone',
  details->>'mobile_phone',
  details->>'nif',
  COALESCE(details->>'status', 'Ativo'),
  COALESCE(details->>'access_level', 'Operacional'),
  details->>'agency_location',
  details->>'admission_date',
  details->>'avatar_color',
  details->>'avatar',
  COALESCE((details->'permissions')::jsonb, '[]'::jsonb),
  details->>'emergency_contact',
  details->>'notes',
  COALESCE((details->>'created_at')::timestamptz, created_at),
  COALESCE((details->>'updated_at')::timestamptz, created_at)
FROM public.audit_log
WHERE action IN ('colaborador_created', 'colaborador_updated')
  AND details->>'id' IS NOT NULL
  AND details->>'name' IS NOT NULL
ORDER BY details->>'id', created_at DESC, id DESC
ON CONFLICT (id) DO NOTHING;

-- Remove deleted collaborators if deletion happened after the last update
DELETE FROM public.colaboradores c
WHERE EXISTS (
  SELECT 1 FROM public.audit_log a
  WHERE a.tenant_id = c.tenant_id
    AND a.action = 'colaborador_deleted'
    AND a.details->>'id' = c.id
    AND a.created_at >= c.updated_at
);

COMMIT;
NOTIFY pgrst, 'reload schema';
