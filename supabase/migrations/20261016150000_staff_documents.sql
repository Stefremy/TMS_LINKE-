-- Staff and company documents are private. All access is mediated by authenticated
-- server routes that check admin or the designated director before using service role.
CREATE TABLE IF NOT EXISTS public.staff_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  owner_type text NOT NULL CHECK (owner_type IN ('linke', 'employee')),
  collaborator_id text,
  collaborator_name text,
  category text NOT NULL,
  title text NOT NULL,
  description text,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  storage_path text NOT NULL UNIQUE,
  uploaded_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_documents_owner_check CHECK (
    (owner_type = 'linke' AND collaborator_id IS NULL) OR
    (owner_type = 'employee' AND collaborator_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS staff_documents_owner_created_idx
  ON public.staff_documents (tenant_id, owner_type, collaborator_id, created_at DESC);

ALTER TABLE public.staff_documents ENABLE ROW LEVEL SECURITY;
-- Intentionally no authenticated or anon policies: only server-side service-role
-- handlers, after app-level authorization, can access this HR/company document vault.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'staff-documents',
  'staff-documents',
  false,
  4194304,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
