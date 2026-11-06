-- Deploy the protected chat download route and legacy-link conversion BEFORE
-- applying this migration, so existing conversations retain access to files.
BEGIN;
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('team-chat-attachments', 'team-chat-attachments', false, 10485760)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760;
-- Access is issued only by the authenticated application endpoint after checking
-- tenant, uploader or message membership. No anonymous/authenticated object policy.
-- A restrictive policy also blocks older, broad storage policies from granting
-- direct access to this bucket. Service-role signed downloads bypass RLS.
DROP POLICY IF EXISTS team_chat_attachments_server_only ON storage.objects;
CREATE POLICY team_chat_attachments_server_only ON storage.objects AS RESTRICTIVE
FOR ALL TO anon, authenticated
USING (bucket_id <> 'team-chat-attachments')
WITH CHECK (bucket_id <> 'team-chat-attachments');
COMMIT;
