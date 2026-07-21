-- ERPmini v6 — políticas mínimas para piloto comercial
-- Revise o e-mail administrador antes de executar.

alter table if exists public.erpmini_licenses enable row level security;
alter table if exists public.erpmini_cloud_data enable row level security;
alter table if exists public.erpmini_signup_requests enable row level security;

-- Remove políticas antigas com os mesmos nomes para permitir reaplicação.
drop policy if exists "v6_license_read_own" on public.erpmini_licenses;
drop policy if exists "v6_license_admin_all" on public.erpmini_licenses;
drop policy if exists "v6_cloud_own_rows" on public.erpmini_cloud_data;
drop policy if exists "v6_signup_insert_own" on public.erpmini_signup_requests;
drop policy if exists "v6_signup_admin_read" on public.erpmini_signup_requests;
drop policy if exists "v6_signup_admin_update" on public.erpmini_signup_requests;

create policy "v6_license_read_own"
on public.erpmini_licenses
for select
to authenticated
using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "v6_license_admin_all"
on public.erpmini_licenses
for all
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'pabloradamez10@gmail.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'pabloradamez10@gmail.com');

create policy "v6_cloud_own_rows"
on public.erpmini_cloud_data
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "v6_signup_insert_own"
on public.erpmini_signup_requests
for insert
to authenticated
with check (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "v6_signup_admin_read"
on public.erpmini_signup_requests
for select
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'pabloradamez10@gmail.com');

create policy "v6_signup_admin_update"
on public.erpmini_signup_requests
for update
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'pabloradamez10@gmail.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'pabloradamez10@gmail.com');
