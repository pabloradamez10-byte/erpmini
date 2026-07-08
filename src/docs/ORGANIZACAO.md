# Reorganização ERPmini

## Etapa 1
Criar estrutura modular sem alterar o App.jsx principal.

## Etapa 2
Mover funções utilitárias:
- fmtCur
- fmtDate
- normalizePlan
- loadLS
- saveLS

## Etapa 3
Mover Painel Master:
- AdminCompaniesPanel
- StoreCard
- LicenseManager

## Etapa 4
Mover telas principais:
- Dashboard
- PDV
- Estoque
- Clientes
- Caixa
- Fiscal
- Configurações

## Regra
Nunca refatorar tudo de uma vez.
Cada etapa precisa subir, compilar e testar antes da próxima.
