-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Enum types
create type shipment_status as enum (
  'rascunho', 'pendente', 'aguarda_correcao', 'recolha', 
  'atribuido_motorista', 'recolhido', 'entrada_rede', 
  'em_distribuicao', 'entregue', 'incidencia', 'devolvido', 'cancelado'
);

create type membership_role as enum (
  'staff_admin', 'staff_ops', 'staff_driver', 'client_owner', 'client_ops'
);

-- Core tables
create table tenants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz default now()
);

create table clients (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- User mapping & roles
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null
);

create table memberships (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  role membership_role not null,
  created_at timestamptz default now(),
  unique(user_id, tenant_id)
);

create table staff_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Domain Models
create table shipments (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  tracking_number text,
  status shipment_status not null default 'rascunho',
  ops_substatus text,
  
  -- Sender details
  sender_name text not null,
  sender_address text not null,
  sender_zip3 text,
  sender_zip4 text,
  
  -- Recipient details
  recipient_name text not null,
  recipient_address text not null,
  recipient_zip3 text,
  recipient_zip4 text,
  
  service_type text not null,
  buy_price numeric,
  sell_price numeric,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table packages (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  shipment_id uuid not null references shipments(id) on delete cascade,
  weight_g integer not null default 0,
  dimensions jsonb,
  created_at timestamptz default now()
);

create table recolhas (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  status text not null,
  scheduled_date date not null,
  ctt_pickup_id text,
  created_at timestamptz default now()
);

create table tracking_events (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  shipment_id uuid not null references shipments(id) on delete cascade,
  event_code text not null,
  description text not null,
  timestamp timestamptz not null default now(),
  created_at timestamptz default now()
);

create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);

-- Setup Row Level Security (RLS)

alter table tenants enable row level security;
alter table clients enable row level security;
alter table users enable row level security;
alter table memberships enable row level security;
alter table staff_profiles enable row level security;
alter table shipments enable row level security;
alter table packages enable row level security;
alter table recolhas enable row level security;
alter table tracking_events enable row level security;
alter table audit_log enable row level security;

-- Basic policies to allow service role full access
-- Clients will get scoped access based on auth.jwt() -> app_metadata -> tenant_id in a later step
