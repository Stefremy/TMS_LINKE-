-- Internal chat. Browser roles have no table access; authenticated OPS handlers
-- verify staff, tenant and both participants before using the service role.
BEGIN;
CREATE TABLE IF NOT EXISTS public.team_chat_members (
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  avatar_url text CHECK (char_length(avatar_url) <= 500),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.team_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence integer GENERATED ALWAYS AS IDENTITY UNIQUE,
  tenant_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  recipient_id uuid,
  sender_name text NOT NULL CHECK (char_length(sender_name) BETWEEN 1 AND 120),
  sender_avatar_url text CHECK (char_length(sender_avatar_url) <= 500),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  client_message_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, sender_id) REFERENCES public.team_chat_members (tenant_id, user_id),
  FOREIGN KEY (tenant_id, recipient_id) REFERENCES public.team_chat_members (tenant_id, user_id),
  CHECK (recipient_id IS NULL OR recipient_id <> sender_id),
  UNIQUE (tenant_id, sender_id, client_message_id)
);

CREATE INDEX IF NOT EXISTS team_chat_general_idx ON public.team_chat_messages (tenant_id, sequence DESC) WHERE recipient_id IS NULL;
CREATE INDEX IF NOT EXISTS team_chat_sender_idx ON public.team_chat_messages (tenant_id, sender_id, recipient_id, sequence DESC) WHERE recipient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS team_chat_recipient_idx ON public.team_chat_messages (tenant_id, recipient_id, sender_id, sequence DESC) WHERE recipient_id IS NOT NULL;
ALTER TABLE public.team_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_chat_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.team_chat_members, public.team_chat_messages FROM anon, authenticated;
GRANT ALL ON public.team_chat_members, public.team_chat_messages TO service_role;
REVOKE ALL ON SEQUENCE public.team_chat_messages_sequence_seq FROM anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.team_chat_messages_sequence_seq TO service_role;
COMMIT;
