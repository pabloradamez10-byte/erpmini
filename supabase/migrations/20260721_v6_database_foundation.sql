-- ERPmini v6 — Fundação definitiva do banco de dados
-- Migração idempotente: pode ser executada novamente com segurança.
-- Mantém compatibilidade com o modelo atual (erpmini_cloud_data) e prepara
-- a estrutura normalizada para a evolução comercial do SaaS.

begin;

create extension if not exists pgcrypto;

-- =========================================================
-- FUNÇÕES AUXILIARES
-- =========================================================

create or replace function public.erpmini_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'pabloradamez10@gmail.com';
$$;

revoke all on function public.erpmini_is_platform_admin() from public;
grant execute on function public.erpmini_is_platform_admin() to authenticated;

create or replace function public.erpmini_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- TABELAS EXISTENTES — COMPLEMENTOS SEM APAGAR DADOS
-- =========================================================

create table if not exists public.erpmini_licenses (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  status text not null default 'pendente',
  plan text not null default 'starter',
  expires_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.erpmini_licenses
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists company_id uuid,
  add column if not exists company_name text,
  add column if not exists trade_name text,
  add column if not exists responsible_name text,
  add column if not exists phone text,
  add column if not exists cnpj text,
  add column if not exists business_type text default 'comercio',
  add column if not exists monthly_value numeric(12,2),
  add column if not exists billing_cycle text default 'monthly',
  add column if not exists hotmart_subscription_id text,
  add column if not exists hotmart_transaction_id text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.erpmini_licenses
set id = gen_random_uuid()
where id is null;

create unique index if not exists erpmini_licenses_email_uidx
  on public.erpmini_licenses (lower(email));

create index if not exists erpmini_licenses_status_idx
  on public.erpmini_licenses (status);

create index if not exists erpmini_licenses_expires_idx
  on public.erpmini_licenses (expires_at);

create table if not exists public.erpmini_cloud_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.erpmini_cloud_data
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create table if not exists public.erpmini_signup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'pendente',
  business_type text not null default 'comercio',
  company_name text,
  phone text,
  notes text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.erpmini_signup_requests
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists status text default 'pendente',
  add column if not exists business_type text default 'comercio',
  add column if not exists company_name text,
  add column if not exists phone text,
  add column if not exists notes text,
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.erpmini_signup_requests
set id = gen_random_uuid()
where id is null;

create index if not exists erpmini_signup_requests_status_idx
  on public.erpmini_signup_requests (status, created_at desc);

-- =========================================================
-- NÚCLEO MULTIEMPRESA
-- =========================================================

create table if not exists public.erpmini_companies (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  legal_name text,
  trade_name text not null,
  cnpj text,
  email text,
  phone text,
  city text,
  state text,
  business_type text not null default 'comercio',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint erpmini_companies_business_type_chk
    check (business_type in ('comercio','servicos','hibrido')),
  constraint erpmini_companies_status_chk
    check (status in ('active','blocked','archived'))
);

create unique index if not exists erpmini_companies_cnpj_uidx
  on public.erpmini_companies (cnpj)
  where cnpj is not null and cnpj <> '';

create index if not exists erpmini_companies_owner_idx
  on public.erpmini_companies (owner_user_id);

create table if not exists public.erpmini_company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.erpmini_companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'operator',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint erpmini_company_members_role_chk
    check (role in ('owner','manager','operator','cashier','technician')),
  unique (company_id, user_id)
);

create index if not exists erpmini_company_members_user_idx
  on public.erpmini_company_members (user_id, active);

create or replace function public.erpmini_is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.erpmini_is_platform_admin()
    or exists (
      select 1
      from public.erpmini_company_members m
      where m.company_id = target_company_id
        and m.user_id = auth.uid()
        and m.active = true
    )
    or exists (
      select 1
      from public.erpmini_companies c
      where c.id = target_company_id
        and c.owner_user_id = auth.uid()
    );
$$;

revoke all on function public.erpmini_is_company_member(uuid) from public;
grant execute on function public.erpmini_is_company_member(uuid) to authenticated;

-- =========================================================
-- CADASTROS E OPERAÇÃO NORMALIZADA
-- =========================================================

create table if not exists public.erpmini_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.erpmini_companies(id) on delete cascade,
  code text,
  barcode text,
  name text not null,
  category text,
  cost numeric(12,2) not null default 0,
  price numeric(12,2) not null default 0,
  stock numeric(14,3) not null default 0,
  min_stock numeric(14,3) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists erpmini_products_company_idx
  on public.erpmini_products (company_id, active);
create unique index if not exists erpmini_products_barcode_uidx
  on public.erpmini_products (company_id, barcode)
  where barcode is not null and barcode <> '';

create table if not exists public.erpmini_clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.erpmini_companies(id) on delete cascade,
  name text not null,
  document text,
  email text,
  phone text,
  address jsonb not null default '{}'::jsonb,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists erpmini_clients_company_idx
  on public.erpmini_clients (company_id, active);

create table if not exists public.erpmini_sales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.erpmini_companies(id) on delete cascade,
  client_id uuid references public.erpmini_clients(id) on delete set null,
  number bigint,
  status text not null default 'completed',
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  payment_data jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint erpmini_sales_status_chk
    check (status in ('draft','completed','cancelled'))
);

create index if not exists erpmini_sales_company_date_idx
  on public.erpmini_sales (company_id, created_at desc);

create table if not exists public.erpmini_sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.erpmini_sales(id) on delete cascade,
  company_id uuid not null references public.erpmini_companies(id) on delete cascade,
  product_id uuid references public.erpmini_products(id) on delete set null,
  description text not null,
  quantity numeric(14,3) not null default 1,
  unit_price numeric(12,2) not null default 0,
  unit_cost numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists erpmini_sale_items_sale_idx
  on public.erpmini_sale_items (sale_id);

create table if not exists public.erpmini_cash_ops (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.erpmini_companies(id) on delete cascade,
  type text not null,
  description text,
  amount numeric(12,2) not null,
  payment_method text,
  reference_type text,
  reference_id uuid,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint erpmini_cash_ops_type_chk
    check (type in ('opening','income','expense','withdrawal','deposit','closing'))
);

create index if not exists erpmini_cash_ops_company_date_idx
  on public.erpmini_cash_ops (company_id, occurred_at desc);

create table if not exists public.erpmini_services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.erpmini_companies(id) on delete cascade,
  client_id uuid references public.erpmini_clients(id) on delete set null,
  number bigint,
  status text not null default 'aberto',
  approval_status text not null default 'nao_enviado',
  description text not null,
  diagnosis text,
  equipment text,
  identifier text,
  technician_user_id uuid references auth.users(id) on delete set null,
  promised_date date,
  warranty_days integer not null default 90,
  warranty_notes text,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  cost numeric(12,2) not null default 0,
  profit numeric(12,2) not null default 0,
  payment_method text,
  paid_at timestamptz,
  signature_url text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint erpmini_services_status_chk
    check (status in ('orcamento','aguardando_aprovacao','aprovado','aberto','andamento','pagamento','concluido','cancelado'))
);

create index if not exists erpmini_services_company_status_idx
  on public.erpmini_services (company_id, status, created_at desc);

create table if not exists public.erpmini_service_items (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.erpmini_services(id) on delete cascade,
  company_id uuid not null references public.erpmini_companies(id) on delete cascade,
  item_type text not null,
  product_id uuid references public.erpmini_products(id) on delete set null,
  description text not null,
  quantity numeric(14,3) not null default 1,
  unit_price numeric(12,2) not null default 0,
  unit_cost numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  reserved boolean not null default false,
  created_at timestamptz not null default now(),
  constraint erpmini_service_items_type_chk
    check (item_type in ('labor','material'))
);

create index if not exists erpmini_service_items_service_idx
  on public.erpmini_service_items (service_id);

create table if not exists public.erpmini_service_media (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.erpmini_services(id) on delete cascade,
  company_id uuid not null references public.erpmini_companies(id) on delete cascade,
  media_type text not null,
  storage_path text not null,
  filename text,
  mime_type text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint erpmini_service_media_type_chk
    check (media_type in ('photo','attachment','signature'))
);

create table if not exists public.erpmini_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.erpmini_companies(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, key)
);

create table if not exists public.erpmini_audit_logs (
  id bigint generated by default as identity primary key,
  company_id uuid references public.erpmini_companies(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists erpmini_audit_logs_company_date_idx
  on public.erpmini_audit_logs (company_id, created_at desc);

-- =========================================================
-- GATILHOS updated_at
-- =========================================================

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'erpmini_licenses','erpmini_cloud_data','erpmini_signup_requests',
    'erpmini_companies','erpmini_company_members','erpmini_products',
    'erpmini_clients','erpmini_sales','erpmini_services','erpmini_settings'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.erpmini_set_updated_at()',
      table_name
    );
  end loop;
end $$;

-- =========================================================
-- RLS — MODELO ATUAL
-- =========================================================

alter table public.erpmini_licenses enable row level security;
alter table public.erpmini_cloud_data enable row level security;
alter table public.erpmini_signup_requests enable row level security;

-- Limpa policies v6 anteriores e recria de forma consolidada.
drop policy if exists "v6_license_read_own" on public.erpmini_licenses;
drop policy if exists "v6_license_admin_all" on public.erpmini_licenses;
drop policy if exists "v6_cloud_own_rows" on public.erpmini_cloud_data;
drop policy if exists "v6_cloud_admin_all" on public.erpmini_cloud_data;
drop policy if exists "v6_signup_insert_own" on public.erpmini_signup_requests;
drop policy if exists "v6_signup_read_own" on public.erpmini_signup_requests;
drop policy if exists "v6_signup_admin_read" on public.erpmini_signup_requests;
drop policy if exists "v6_signup_admin_update" on public.erpmini_signup_requests;

create policy "v6_license_read_own"
on public.erpmini_licenses for select to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or public.erpmini_is_platform_admin()
);

create policy "v6_license_admin_all"
on public.erpmini_licenses for all to authenticated
using (public.erpmini_is_platform_admin())
with check (public.erpmini_is_platform_admin());

create policy "v6_cloud_own_rows"
on public.erpmini_cloud_data for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "v6_cloud_admin_all"
on public.erpmini_cloud_data for all to authenticated
using (public.erpmini_is_platform_admin())
with check (public.erpmini_is_platform_admin());

create policy "v6_signup_insert_own"
on public.erpmini_signup_requests for insert to authenticated
with check (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  and (user_id is null or user_id = auth.uid())
);

create policy "v6_signup_read_own"
on public.erpmini_signup_requests for select to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or public.erpmini_is_platform_admin()
);

create policy "v6_signup_admin_update"
on public.erpmini_signup_requests for update to authenticated
using (public.erpmini_is_platform_admin())
with check (public.erpmini_is_platform_admin());

-- =========================================================
-- RLS — MODELO NORMALIZADO
-- =========================================================

alter table public.erpmini_companies enable row level security;
alter table public.erpmini_company_members enable row level security;
alter table public.erpmini_products enable row level security;
alter table public.erpmini_clients enable row level security;
alter table public.erpmini_sales enable row level security;
alter table public.erpmini_sale_items enable row level security;
alter table public.erpmini_cash_ops enable row level security;
alter table public.erpmini_services enable row level security;
alter table public.erpmini_service_items enable row level security;
alter table public.erpmini_service_media enable row level security;
alter table public.erpmini_settings enable row level security;
alter table public.erpmini_audit_logs enable row level security;

-- Policies genéricas por company_id.
do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'erpmini_products','erpmini_clients','erpmini_sales','erpmini_sale_items',
    'erpmini_cash_ops','erpmini_services','erpmini_service_items',
    'erpmini_service_media','erpmini_settings'
  ]
  loop
    policy_name := table_name || '_company_access';
    execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.erpmini_is_company_member(company_id)) with check (public.erpmini_is_company_member(company_id))',
      policy_name,
      table_name
    );
  end loop;
end $$;

drop policy if exists erpmini_companies_access on public.erpmini_companies;
create policy erpmini_companies_access
on public.erpmini_companies for all to authenticated
using (
  owner_user_id = auth.uid()
  or public.erpmini_is_company_member(id)
  or public.erpmini_is_platform_admin()
)
with check (
  owner_user_id = auth.uid()
  or public.erpmini_is_platform_admin()
);

drop policy if exists erpmini_company_members_access on public.erpmini_company_members;
create policy erpmini_company_members_access
on public.erpmini_company_members for all to authenticated
using (
  user_id = auth.uid()
  or public.erpmini_is_company_member(company_id)
  or public.erpmini_is_platform_admin()
)
with check (
  public.erpmini_is_company_member(company_id)
  or public.erpmini_is_platform_admin()
);

drop policy if exists erpmini_audit_logs_read on public.erpmini_audit_logs;
create policy erpmini_audit_logs_read
on public.erpmini_audit_logs for select to authenticated
using (
  public.erpmini_is_platform_admin()
  or (company_id is not null and public.erpmini_is_company_member(company_id))
);

drop policy if exists erpmini_audit_logs_insert on public.erpmini_audit_logs;
create policy erpmini_audit_logs_insert
on public.erpmini_audit_logs for insert to authenticated
with check (
  user_id = auth.uid()
  and (company_id is null or public.erpmini_is_company_member(company_id))
);

-- =========================================================
-- PERMISSÕES
-- =========================================================

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

commit;

-- Resultado esperado no SQL Editor: Success. No rows returned.
