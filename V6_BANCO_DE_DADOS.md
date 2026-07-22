# ERPmini v6 — Fundação definitiva do banco

## Objetivo

Esta etapa corrige a divergência entre o Painel Master e a tabela `erpmini_licenses` e prepara a base multiempresa do ERPmini para o piloto comercial.

## Correção imediata

A tabela `erpmini_licenses` agora passa a suportar os campos usados pelo Painel Master:

- `company_name`
- `trade_name`
- `responsible_name`
- `phone`
- `cnpj`
- `business_type`
- `monthly_value`
- `billing_cycle`
- `hotmart_subscription_id`
- `hotmart_transaction_id`
- `created_at`
- `updated_at`

Isso corrige o erro:

```text
Could not find the 'cnpj' column of 'erpmini_licenses' in the schema cache
```

## Compatibilidade

A migração não remove os dados atuais. O ERP continua usando `erpmini_cloud_data` como snapshot JSON enquanto a migração gradual para as tabelas normalizadas é desenvolvida.

## Estrutura preparada

Foram criadas as bases para:

- empresas;
- membros e funções por empresa;
- produtos;
- clientes;
- vendas e itens de venda;
- caixa;
- ordens de serviço;
- mão de obra e materiais das OS;
- fotos, anexos e assinatura;
- configurações;
- auditoria.

## Segurança

A migração:

- mantém a licença visível apenas para o próprio e-mail;
- libera o Painel Master apenas para `pabloradamez10@gmail.com`;
- permite que cada usuário acesse apenas o próprio snapshot;
- permite ao administrador consultar snapshots para suporte;
- protege as tabelas normalizadas por `company_id`;
- cria funções auxiliares centralizadas para validar administrador e membro da empresa.

## Arquivo para executar

```text
supabase/migrations/20260721_v6_database_foundation.sql
```

No Supabase:

1. Abra **SQL Editor**.
2. Clique em **New query**.
3. Copie todo o conteúdo do arquivo.
4. Cole no editor.
5. Clique em **Run**.

Resultado esperado:

```text
Success. No rows returned
```

## Teste imediato depois da execução

1. Entrar no ERP com a conta administradora.
2. Abrir o Painel Master.
3. Aprovar novamente a solicitação pendente.
4. Confirmar que o erro da coluna `cnpj` desapareceu.
5. Entrar com a conta aprovada.
6. Criar produto, cliente e ordem de serviço.
7. Sair e entrar novamente.
8. Confirmar que os dados continuam disponíveis e isolados.

## Próxima fase técnica

A estrutura normalizada já existe, mas o aplicativo ainda grava a operação principal em snapshot JSON. A migração deve acontecer módulo por módulo, nesta ordem:

1. empresas e membros;
2. produtos e clientes;
3. vendas e caixa;
4. serviços e anexos;
5. desligamento gradual do snapshot monolítico.

Essa estratégia evita perda de dados e mantém o ERP funcionando durante a evolução.
