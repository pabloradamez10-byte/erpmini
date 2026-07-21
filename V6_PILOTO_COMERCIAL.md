# ERPmini v6 — Piloto Comercial

Esta versão prepara o ERPmini para testes com clientes reais.

## Alterações aplicadas

- Licença única pelo Supabase; o antigo segundo bloqueio por Google Sheets foi desativado.
- Identificação visual atualizada para `v6-piloto-comercial`.
- Migração SQL de RLS adicionada para licenças, dados em nuvem e solicitações de cadastro.
- Fluxo guiado de Serviços v5 preservado.

## Aplicação obrigatória no Supabase

Execute o arquivo:

`supabase/migrations/20260721_v6_pilot_rls.sql`

no SQL Editor do Supabase antes de liberar usuários externos.

## Testes mínimos do piloto

1. Criar uma conta comum e solicitar acesso.
2. Aprovar a licença pelo Painel Master.
3. Confirmar que a conta comum só lê a própria licença.
4. Criar dados, sair e entrar novamente.
5. Entrar em outro aparelho e confirmar a recuperação pela nuvem.
6. Confirmar que uma conta não acessa o snapshot de outra.
