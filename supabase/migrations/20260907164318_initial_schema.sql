-- Create webservice_connections table
CREATE TABLE IF NOT EXISTS public.webservice_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL,
    connector_type TEXT NOT NULL, -- Enum later if needed (e.g., CTT, DPD)
    supplier_id UUID, -- Assuming a suppliers table exists or will exist
    operating_center_id UUID, -- Nullable means 'all'
    branch_account_code TEXT,
    api_username TEXT,
    api_session_id TEXT, -- Note: Store encrypted in real world
    credentials JSONB DEFAULT '{}'::jsonb, -- Store dynamic credentials based on connector
    force_shipment BOOLEAN DEFAULT false,
    auto_activate BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create service_mappings table
CREATE TABLE IF NOT EXISTS public.service_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES public.webservice_connections(id) ON DELETE CASCADE,
    internal_service_name TEXT NOT NULL,
    destination_zone TEXT, -- Domestic/International etc.
    weight_tier TEXT, -- Base / +1 unit
    external_service_code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create goods_type_mappings table
CREATE TABLE IF NOT EXISTS public.goods_type_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES public.webservice_connections(id) ON DELETE CASCADE,
    internal_type TEXT NOT NULL, -- e.g., 'Caixa', 'Palete'
    external_type_code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies (Open for development)
ALTER TABLE public.webservice_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for authenticated users" ON public.webservice_connections FOR ALL USING (true);

ALTER TABLE public.service_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for authenticated users" ON public.service_mappings FOR ALL USING (true);

ALTER TABLE public.goods_type_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for authenticated users" ON public.goods_type_mappings FOR ALL USING (true);
