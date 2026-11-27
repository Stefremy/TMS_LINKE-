-- One-off, run AFTER deploying the on-demand mailbox HTML (lib/ops-mailbox.ts mailAuditRows).
-- Moves bodyHtml out of ops_mailbox_message rows into ops_mailbox_body rows, 100 emails per run.
-- Repeat until it returns moved = 0. Each run is one transaction: copy + strip together or not at all.
with batch as (
  select id, tenant_id, user_id, created_at, details
  from audit_log
  where action = 'ops_mailbox_message' and details ? 'bodyHtml'
  limit 100
  for update skip locked
), copied as (
  insert into audit_log (tenant_id, user_id, action, details, created_at)
  select tenant_id, user_id, 'ops_mailbox_body',
         jsonb_build_object('id', details->>'id', 'html', details->'bodyHtml'), created_at
  from batch
  where details->>'bodyHtml' is not null
  returning 1
), stripped as (
  update audit_log a set details = a.details - 'bodyHtml'
  from batch where a.id = batch.id
  returning 1
)
select (select count(*) from stripped) as moved, (select count(*) from copied) as bodies;
