-- SEC-003: Restrict direct client access on shipments and packages to SELECT only.
-- All mutations (creation, updates, deletes) must go through server-side actions/RPCs.
begin;

-- 1. Shipments: drop old FOR ALL policy and replace with SELECT only
drop policy if exists "Clients can manage their own shipments" on public.shipments;
drop policy if exists "Clients can view their own shipments" on public.shipments;

create policy "Clients can view their own shipments"
  on public.shipments
  for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'client'
    and client_id = (auth.jwt() -> 'app_metadata' ->> 'client_id')::uuid
  );

-- 2. Packages: drop old FOR ALL policy and replace with SELECT only
drop policy if exists "Clients can manage their own packages" on public.packages;
drop policy if exists "Clients can view their own packages" on public.packages;

create policy "Clients can view their own packages"
  on public.packages
  for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'client'
    and exists (
      select 1 from public.shipments s
       where s.id = packages.shipment_id
         and s.client_id = (auth.jwt() -> 'app_metadata' ->> 'client_id')::uuid
    )
  );

notify pgrst, 'reload schema';

commit;

