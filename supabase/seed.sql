-- supabase/seed.sql

-- Insert the primary operator tenant (LINKE)
insert into public.tenants (id, name)
values ('11111111-1111-1111-1111-111111111111', 'LINKE')
on conflict (id) do nothing;

-- Insert Phase 1 clients belonging to LINKE
insert into public.clients (id, tenant_id, name)
values 
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'CACTO'),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'DETAILER')
on conflict (id) do nothing;
