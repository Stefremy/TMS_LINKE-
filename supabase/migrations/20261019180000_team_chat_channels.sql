-- Optional native table for team chat channels.
-- Channels are already dynamically tracked via audit_log, but this migration provides 
-- the schema if dedicated relational constraints are preferred in the future.
BEGIN;

CREATE TABLE IF NOT EXISTS public.team_chat_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  slug text NOT NULL CHECK (char_length(slug) BETWEEN 1 AND 50),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  description text CHECK (char_length(description) <= 250),
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

ALTER TABLE public.team_chat_channels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.team_chat_channels FROM anon, authenticated;
GRANT ALL ON public.team_chat_channels TO service_role;

CREATE INDEX IF NOT EXISTS team_chat_channels_tenant_idx ON public.team_chat_channels (tenant_id, created_at);

COMMIT;
