begin;

-- Fase 2: produtos e clientes passam a ter uma linha por cadastro.
-- O snapshot legado permanece intacto durante toda a transição.

alter table public.erpmini_products
  add column if not exists legacy_id text,
  add column if not exists legacy_payload jsonb not null default '{}'::jsonb;

alter table public.erpmini_clients
  add column if not exists legacy_id text,
  add column if not exists credit_limit numeric(12,2) not null default 0,
  add column if not exists legacy_payload jsonb not null default '{}'::jsonb;

create unique index if not exists erpmini_products_legacy_id_uidx
  on public.erpmini_products (company_id, legacy_id)
  where legacy_id is not null and legacy_id <> '';

create unique index if not exists erpmini_clients_legacy_id_uidx
  on public.erpmini_clients (company_id, legacy_id)
  where legacy_id is not null and legacy_id <> '';

-- Cria uma empresa operacional para cada snapshot que ainda não possui uma.
insert into public.erpmini_companies (owner_user_id, trade_name, business_type)
select
  d.user_id,
  coalesce(nullif(btrim(d.data ->> 'erpmini_storename'), ''), 'Minha Loja'),
  'comercio'
from public.erpmini_cloud_data d
where not exists (
  select 1
  from public.erpmini_companies c
  where c.owner_user_id = d.user_id
    and c.status = 'active'
);

insert into public.erpmini_company_members (company_id, user_id, role, active)
select c.id, c.owner_user_id, 'owner', true
from public.erpmini_companies c
join public.erpmini_cloud_data d on d.user_id = c.owner_user_id
where c.status = 'active'
on conflict (company_id, user_id)
do update set role = 'owner', active = true, updated_at = now();

with owner_companies as (
  select distinct on (c.owner_user_id)
    c.owner_user_id as user_id,
    c.id as company_id
  from public.erpmini_companies c
  where c.status = 'active'
  order by c.owner_user_id, c.created_at, c.id
),
items as (
  select
    d.user_id,
    x.item,
    nullif(btrim(x.item ->> 'id'), '') as legacy_id
  from public.erpmini_cloud_data d
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(d.data -> 'erpmini_products') = 'array'
        then d.data -> 'erpmini_products'
      else '[]'::jsonb
    end
  ) x(item)
)
insert into public.erpmini_products (
  company_id, legacy_id, barcode, name, category, cost, price, stock,
  active, legacy_payload
)
select
  oc.company_id,
  i.legacy_id,
  nullif(btrim(i.item ->> 'barcode'), ''),
  coalesce(nullif(btrim(i.item ->> 'name'), ''), 'Produto sem nome'),
  nullif(btrim(i.item ->> 'category'), ''),
  case when coalesce(i.item ->> 'cost', i.item ->> 'lastCost', '') ~ '^-?[0-9]+([.][0-9]+)?$'
    then coalesce(i.item ->> 'cost', i.item ->> 'lastCost')::numeric else 0 end,
  case when coalesce(i.item ->> 'price', '') ~ '^-?[0-9]+([.][0-9]+)?$'
    then (i.item ->> 'price')::numeric else 0 end,
  case when coalesce(i.item ->> 'stock', '') ~ '^-?[0-9]+([.][0-9]+)?$'
    then (i.item ->> 'stock')::numeric else 0 end,
  coalesce((i.item ->> 'active')::boolean, true),
  i.item
from items i
join owner_companies oc using (user_id)
where i.legacy_id is not null
on conflict (company_id, legacy_id) where legacy_id is not null and legacy_id <> ''
do update set
  barcode = excluded.barcode,
  name = excluded.name,
  category = excluded.category,
  cost = excluded.cost,
  price = excluded.price,
  stock = excluded.stock,
  active = excluded.active,
  legacy_payload = excluded.legacy_payload,
  updated_at = now();

with owner_companies as (
  select distinct on (c.owner_user_id)
    c.owner_user_id as user_id,
    c.id as company_id
  from public.erpmini_companies c
  where c.status = 'active'
  order by c.owner_user_id, c.created_at, c.id
),
items as (
  select
    d.user_id,
    x.item,
    nullif(btrim(x.item ->> 'id'), '') as legacy_id
  from public.erpmini_cloud_data d
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(d.data -> 'erpmini_clients') = 'array'
        then d.data -> 'erpmini_clients'
      else '[]'::jsonb
    end
  ) x(item)
)
insert into public.erpmini_clients (
  company_id, legacy_id, name, phone, credit_limit, active, legacy_payload
)
select
  oc.company_id,
  i.legacy_id,
  coalesce(nullif(btrim(i.item ->> 'name'), ''), 'Cliente sem nome'),
  nullif(btrim(i.item ->> 'phone'), ''),
  case when coalesce(i.item ->> 'limit', '') ~ '^-?[0-9]+([.][0-9]+)?$'
    then (i.item ->> 'limit')::numeric else 0 end,
  coalesce((i.item ->> 'active')::boolean, true),
  i.item
from items i
join owner_companies oc using (user_id)
where i.legacy_id is not null
on conflict (company_id, legacy_id) where legacy_id is not null and legacy_id <> ''
do update set
  name = excluded.name,
  phone = excluded.phone,
  credit_limit = excluded.credit_limit,
  active = excluded.active,
  legacy_payload = excluded.legacy_payload,
  updated_at = now();

create or replace function public.erpmini_sync_catalog(
  p_store_name text,
  p_products jsonb,
  p_clients jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_company_id uuid;
  product_item jsonb;
  client_item jsonb;
  current_legacy_id text;
  product_count integer := 0;
  client_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if jsonb_typeof(p_products) <> 'array' or jsonb_typeof(p_clients) <> 'array' then
    raise exception 'INVALID_CATALOG_PAYLOAD';
  end if;

  select c.id into target_company_id
  from public.erpmini_companies c
  where c.owner_user_id = current_user_id
    and c.status = 'active'
  order by c.created_at, c.id
  limit 1;

  if target_company_id is null then
    insert into public.erpmini_companies (owner_user_id, trade_name, business_type)
    values (
      current_user_id,
      coalesce(nullif(btrim(p_store_name), ''), 'Minha Loja'),
      'comercio'
    )
    returning id into target_company_id;
  else
    update public.erpmini_companies
    set trade_name = coalesce(nullif(btrim(p_store_name), ''), trade_name),
        updated_at = now()
    where id = target_company_id;
  end if;

  insert into public.erpmini_company_members (company_id, user_id, role, active)
  values (target_company_id, current_user_id, 'owner', true)
  on conflict (company_id, user_id)
  do update set role = 'owner', active = true, updated_at = now();

  for product_item in select value from jsonb_array_elements(p_products)
  loop
    current_legacy_id := nullif(btrim(product_item ->> 'id'), '');
    if current_legacy_id is null then
      raise exception 'PRODUCT_WITHOUT_ID';
    end if;

    insert into public.erpmini_products (
      company_id, legacy_id, barcode, name, category, cost, price, stock,
      active, legacy_payload
    )
    values (
      target_company_id,
      current_legacy_id,
      nullif(btrim(product_item ->> 'barcode'), ''),
      coalesce(nullif(btrim(product_item ->> 'name'), ''), 'Produto sem nome'),
      nullif(btrim(product_item ->> 'category'), ''),
      case when coalesce(product_item ->> 'cost', product_item ->> 'lastCost', '') ~ '^-?[0-9]+([.][0-9]+)?$'
        then coalesce(product_item ->> 'cost', product_item ->> 'lastCost')::numeric else 0 end,
      case when coalesce(product_item ->> 'price', '') ~ '^-?[0-9]+([.][0-9]+)?$'
        then (product_item ->> 'price')::numeric else 0 end,
      case when coalesce(product_item ->> 'stock', '') ~ '^-?[0-9]+([.][0-9]+)?$'
        then (product_item ->> 'stock')::numeric else 0 end,
      coalesce((product_item ->> 'active')::boolean, true),
      product_item
    )
    on conflict (company_id, legacy_id) where legacy_id is not null and legacy_id <> ''
    do update set
      barcode = excluded.barcode,
      name = excluded.name,
      category = excluded.category,
      cost = excluded.cost,
      price = excluded.price,
      stock = excluded.stock,
      active = excluded.active,
      legacy_payload = excluded.legacy_payload,
      updated_at = now();
    product_count := product_count + 1;
  end loop;

  update public.erpmini_products p
  set active = false, updated_at = now()
  where p.company_id = target_company_id
    and p.legacy_id is not null
    and not exists (
      select 1
      from jsonb_array_elements(p_products) x(item)
      where nullif(btrim(x.item ->> 'id'), '') = p.legacy_id
    );

  for client_item in select value from jsonb_array_elements(p_clients)
  loop
    current_legacy_id := nullif(btrim(client_item ->> 'id'), '');
    if current_legacy_id is null then
      raise exception 'CLIENT_WITHOUT_ID';
    end if;

    insert into public.erpmini_clients (
      company_id, legacy_id, name, phone, credit_limit, active, legacy_payload
    )
    values (
      target_company_id,
      current_legacy_id,
      coalesce(nullif(btrim(client_item ->> 'name'), ''), 'Cliente sem nome'),
      nullif(btrim(client_item ->> 'phone'), ''),
      case when coalesce(client_item ->> 'limit', '') ~ '^-?[0-9]+([.][0-9]+)?$'
        then (client_item ->> 'limit')::numeric else 0 end,
      coalesce((client_item ->> 'active')::boolean, true),
      client_item
    )
    on conflict (company_id, legacy_id) where legacy_id is not null and legacy_id <> ''
    do update set
      name = excluded.name,
      phone = excluded.phone,
      credit_limit = excluded.credit_limit,
      active = excluded.active,
      legacy_payload = excluded.legacy_payload,
      updated_at = now();
    client_count := client_count + 1;
  end loop;

  update public.erpmini_clients c
  set active = false, updated_at = now()
  where c.company_id = target_company_id
    and c.legacy_id is not null
    and not exists (
      select 1
      from jsonb_array_elements(p_clients) x(item)
      where nullif(btrim(x.item ->> 'id'), '') = c.legacy_id
    );

  return jsonb_build_object(
    'ok', true,
    'company_id', target_company_id,
    'products', product_count,
    'clients', client_count
  );
end;
$$;

revoke all on function public.erpmini_sync_catalog(text, jsonb, jsonb) from public;
grant execute on function public.erpmini_sync_catalog(text, jsonb, jsonb) to authenticated;

commit;
