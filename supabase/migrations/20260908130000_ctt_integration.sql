-- Migration: CTT Integration Support
-- Table for Carrier Webservices Connections
create table if not exists carrier_connections (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  carrier_code text not null default 'ctt_expresso', -- 'ctt_expresso', 'dpd', etc.
  description text not null,
  client_id text not null,
  contract_number text not null,
  auth_id text not null,
  user_id text,
  distribution_channel integer not null default 99,
  environment text not null default 'qa', -- 'qa' or 'production'
  default_subproduct text not null default 'ERS 24',
  is_active boolean not null default true,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenant_id, carrier_code)
);

-- Backwards-compatibility table for tenant_integrations
create table if not exists tenant_integrations (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider text not null,
  credentials jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenant_id, provider)
);

-- Add CTT tracking and document columns to shipments if not present
alter table shipments 
  add column if not exists ctt_object_id text,
  add column if not exists ctt_delivery_note_id text,
  add column if not exists ctt_label_base64 text,
  add column if not exists ctt_manifest_pdf text;

-- Enable RLS & Policies
alter table carrier_connections enable row level security;
alter table tenant_integrations enable row level security;

create policy if not exists "Allow all operations for carrier_connections" on carrier_connections for all using (true) with check (true);
create policy if not exists "Allow all operations for tenant_integrations" on tenant_integrations for all using (true) with check (true);
