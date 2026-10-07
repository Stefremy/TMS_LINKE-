-- Enable RLS on all sensitive tables
ALTER TABLE IF EXISTS public.carrier_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenant_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.billing_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.client_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.webservice_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.service_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.goods_type_mappings ENABLE ROW LEVEL SECURITY;

-- Drop permissive policies
DROP POLICY IF EXISTS "Allow all operations for carrier_connections" ON public.carrier_connections;
DROP POLICY IF EXISTS "Allow all operations for tenant_integrations" ON public.tenant_integrations;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.webservice_connections;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.service_mappings;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.goods_type_mappings;

-- New secure policies

-- 1. Carrier Connections (Backend / Service Role / Employee)
-- Clients should NEVER read or write carrier connections. Employees might need to configure them.
CREATE POLICY "Employees can manage carrier_connections" ON public.carrier_connections
  FOR ALL TO authenticated USING (auth.role() IN ('employee', 'admin')) WITH CHECK (auth.role() IN ('employee', 'admin'));

-- 2. Tenant Integrations
CREATE POLICY "Employees can manage tenant_integrations" ON public.tenant_integrations
  FOR ALL TO authenticated USING (auth.role() IN ('employee', 'admin')) WITH CHECK (auth.role() IN ('employee', 'admin'));

-- 3. Webservice connections and mappings
CREATE POLICY "Employees can manage webservice_connections" ON public.webservice_connections
  FOR ALL TO authenticated USING (auth.role() IN ('employee', 'admin')) WITH CHECK (auth.role() IN ('employee', 'admin'));

CREATE POLICY "Employees can manage service_mappings" ON public.service_mappings
  FOR ALL TO authenticated USING (auth.role() IN ('employee', 'admin')) WITH CHECK (auth.role() IN ('employee', 'admin'));

CREATE POLICY "Employees can manage goods_type_mappings" ON public.goods_type_mappings
  FOR ALL TO authenticated USING (auth.role() IN ('employee', 'admin')) WITH CHECK (auth.role() IN ('employee', 'admin'));

-- 4. Billing Statements
-- Employees can view all, clients can view only their own
CREATE POLICY "Employees can manage billing_statements" ON public.billing_statements
  FOR ALL TO authenticated USING (auth.role() IN ('employee', 'admin')) WITH CHECK (auth.role() IN ('employee', 'admin'));

CREATE POLICY "Clients can view their own billing_statements" ON public.billing_statements
  FOR SELECT TO authenticated USING (auth.role() = 'client' AND client_id = auth.client_id());

-- 5. Client Transactions
-- Employees can manage all transactions
CREATE POLICY "Employees can manage client_transactions" ON public.client_transactions
  FOR ALL TO authenticated USING (auth.role() IN ('employee', 'admin')) WITH CHECK (auth.role() IN ('employee', 'admin'));

-- Clients can only READ their own transactions (inserts should be done via secure Stripe webhook/RPC backend)
CREATE POLICY "Clients can view their own client_transactions" ON public.client_transactions
  FOR SELECT TO authenticated USING (auth.role() = 'client' AND client_id = auth.client_id());
