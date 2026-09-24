-- Define helper functions for JWT metadata
CREATE OR REPLACE FUNCTION auth.client_id() RETURNS UUID AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'client_id')::UUID;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role';
$$ LANGUAGE SQL STABLE;

-- Ensure RLS is enabled
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;

-- 1. Tenants
-- Employees and Admins can see all tenants
CREATE POLICY "Employees can view all tenants" ON public.tenants
  FOR SELECT USING (auth.role() IN ('employee', 'admin'));

-- 2. Clients
-- Employees and Admins can do anything
CREATE POLICY "Employees can manage clients" ON public.clients
  FOR ALL USING (auth.role() IN ('employee', 'admin'));

-- Clients can only read their own record
CREATE POLICY "Clients can view their own record" ON public.clients
  FOR SELECT USING (auth.role() = 'client' AND id = auth.client_id());

-- 3. Shipments
-- Employees and Admins can do anything
CREATE POLICY "Employees can manage shipments" ON public.shipments
  FOR ALL USING (auth.role() IN ('employee', 'admin'));

-- Clients can only see and manage their own shipments
CREATE POLICY "Clients can manage their own shipments" ON public.shipments
  FOR ALL USING (auth.role() = 'client' AND client_id = auth.client_id());

-- 4. Packages
-- Employees and Admins can do anything
CREATE POLICY "Employees can manage packages" ON public.packages
  FOR ALL USING (auth.role() IN ('employee', 'admin'));

-- Clients can only see and manage packages for their own shipments
CREATE POLICY "Clients can manage their own packages" ON public.packages
  FOR ALL USING (
    auth.role() = 'client' AND 
    EXISTS (SELECT 1 FROM public.shipments s WHERE s.id = packages.shipment_id AND s.client_id = auth.client_id())
  );

-- 5. Tracking Events
CREATE POLICY "Employees can manage tracking events" ON public.tracking_events
  FOR ALL USING (auth.role() IN ('employee', 'admin'));

CREATE POLICY "Clients can view tracking events for their shipments" ON public.tracking_events
  FOR SELECT USING (
    auth.role() = 'client' AND 
    EXISTS (SELECT 1 FROM public.shipments s WHERE s.id = tracking_events.shipment_id AND s.client_id = auth.client_id())
  );
