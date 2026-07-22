-- Permite que um usuário autenticado reabra somente a própria solicitação.
-- Necessário quando uma solicitação foi recusada/excluída e o e-mail ainda
-- não possui licença ativa.

alter table public.erpmini_signup_requests enable row level security;

drop policy if exists "v6_signup_reopen_own" on public.erpmini_signup_requests;

create policy "v6_signup_reopen_own"
on public.erpmini_signup_requests
for update
to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
with check (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  and lower(status) = 'pendente'
);
