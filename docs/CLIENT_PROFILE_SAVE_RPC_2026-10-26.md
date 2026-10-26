# Gravação das tabelas da GO Linke — 26/10/2026

O utilizador recebeu «O saldo pode ter mudado» ao tentar atribuir duas
tabelas à GO Linke. Não existe limite de uma tabela: o formulário grava
uma lista `assigned_linke_service_ids` e uma tabela principal separada.

Na base ligada ao projeto `rcifuhiwemwlatgserva`, a função
`save_client_financial_profile` não está publicada no catálogo PostgREST.
Foi verificada a ausência na descrição OpenAPI e com HEAD para a assinatura
completa, que devolveu 404 / PGRST202, sem executar operações de gravação.
O erro genérico da ação confundia qualquer falha SQL com concorrência de saldo.

## Correção preparada

- A ação distingue função em falta, permissões, conflito efetivo de crédito
  e outras falhas. Não há gravação direta alternativa do perfil.
- A migração
  [`20261026150000_client_profile_save.sql`](../supabase/migrations/20261026150000_client_profile_save.sql)
  publica apenas a função de gravação já existente na migração financeira
  de 22/10, com o mesmo corpo e contrato. Não instala o restante sistema de
  carteira nem atualiza clientes, saldos ou transações ao ser aplicada.
- Mantém o bloqueio por loja/empresa, a comparação de crédito e a execução
  exclusiva por `service_role`. Inclui o pedido de atualização do catálogo
  PostgREST e é segura para executar novamente.

## Aplicação confirmada

O utilizador executou a migração no SQL Editor e recebeu «Success. No rows
returned». A verificação posterior, exclusivamente de leitura, confirmou
que `save_client_financial_profile` já aparece na descrição OpenAPI do
PostgREST com a chave de servidor.

O crédito da GO Linke continuava em 15000 e a lista de tabelas guardadas
continuava com `srv_linke_eq_std`, como antes da instalação. Não foi
executada nenhuma gravação de cliente nem alterada uma atribuição nesta
verificação.

Falta a confirmação funcional na interface: reabrir a ficha GO Linke,
selecionar as duas tabelas, escolher a principal e gravar. Confirmar ambas
após fechar e reabrir a ficha.

A função necessária à gravação atual já está publicada. A melhoria das
mensagens de erro continua a depender da publicação do código.

## Validação

Passaram 19 testes de aplicação e SQL real em PostgreSQL isolado (PGlite):
duas tabelas após reabertura, migração independente das tabelas de carteira,
reexecução sem alterar dados, concorrência de crédito, isolamento entre
empresas e permissões dos papéis. TypeScript passou. Não foram alteradas
atribuições ou saldos da GO Linke ou de outro cliente na base real.
