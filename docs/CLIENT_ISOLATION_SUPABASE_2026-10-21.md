# Supabase e sessões reais — isolamento entre lojas

Verificação: 21/10/2026. Atualização posterior: P01 autorizada, aplicada e verificada no Supabase. Âmbito autorizado: F02, leitura das permissões publicadas e testes com Stef Store e GO Linke. A aplicação testada foi o build local de produção, ligado ao Supabase configurado; o site publicado não foi atualizado nem testado nesta ronda.

## F02 — verificação HTTP

Foram usados dois logins reais do Supabase Auth com função `client`, sem cookies de impersonação:

- Stef Store: conta de cliente existente, sessão obtida por link de autenticação gerado administrativamente e consumido sem enviar email. Não foi testada nem alterada a palavra-passe.
- GO Linke: login temporário criado com autorização expressa, palavra-passe aleatória mantida apenas em memória e autenticação por palavra-passe. A conta foi apagada e as duas sessões usadas no teste foram terminadas.

Os pedidos passaram pelo proxy, cookies, contexto de autorização e Server Action reais. Não foram substituídos os resultados da base nem a autorização por simulações.

| Pedido | Stef Store | GO Linke |
| --- | --- | --- |
| Ler o próprio envio | HTTP 200, 5 eventos | HTTP 200, 12 eventos |
| Ler o envio da outra loja | Recusado, sem eventos | Recusado, sem eventos |
| Combinar o próprio ID com a referência da outra loja | Recusado, sem eventos | Recusado, sem eventos |

Os quatro pedidos autenticados recusados produziram erros de autorização da Server Action, serializados como HTTP 500 no build de produção. Isso não é uma falha de ligação: é o resultado da exceção genérica de acesso negado; não foram devolvidos dados do outro envio. Sem sessão, o pedido recebeu redirecionamento HTTP 307 para autenticação.

Uma primeira passagem usou envios sem eventos e também passou. A passagem final escolheu deliberadamente históricos existentes para confirmar que os controlos positivos não dependiam de listas vazias.

Não houve chamadas a CTT/Correos, envios/recolhas novos, emails, cobranças, faturas ou alteração de dados comerciais. As únicas escritas deliberadas foram a criação/eliminação da conta temporária e os registos/sessões normais de autenticação do Supabase.

## Leitura direta das tabelas

Com cada sessão de cliente foram feitas consultas diretas pela API do Supabase a `clients`, `shipments`, `packages`, `tracking_events`, `client_transactions`, `billing_statements` e `audit_log`, separando a própria loja e a outra.

As 14 combinações sessão/tabela devolveram zero linhas de outra loja. As consultas diretas da própria loja também devolveram zero linhas: isto **não demonstra políticas que permitem ler apenas a própria loja**. O catálogo PostgreSQL explica o resultado: RLS está ativo e não existem políticas nas tabelas verificadas, portanto o acesso direto fica bloqueado por omissão para estas sessões. A aplicação usa o cliente administrativo no servidor, que não fica limitado por RLS; a autorização da aplicação continua essencial.

## Permissões publicadas — resultado confirmado

Na fase inicial foram executadas apenas consultas `SELECT` de metadados na API administrativa do projeto, usando a sessão já aberta no navegador. Nessa fase não foram alteradas políticas, grants ou dados; a alteração de grants P01 foi autorizada e aplicada posteriormente, conforme a atualização abaixo. O [SQL de referência](../supabase/audits/20261021_client_isolation_readonly.sql) permite repetir a inspeção.

- RLS ativo nas oito tabelas existentes verificadas: `clients`, `shipments`, `packages`, `tracking_events`, `audit_log`, `client_transactions`, `billing_statements` e `recurring_statement_cycles`.
- Nenhuma política RLS encontrada nessas tabelas. As primeiras sete têm grants amplos de tabela, mas RLS continua a bloquear as leituras diretas observadas. `recurring_statement_cycles` também não tem esses grants de cliente.
- `client_users`, `servicos_linke`, `shipment_metadata` e `shipment_audit_metadata` não foram encontrados no catálogo publicado. A função `shipment_label_by_id` e o auxiliar `auth.client_id()` também não foram encontrados. Não se deve assumir que todas as migrações do repositório estão aplicadas.
- `auth.role()` publicado lê a função técnica do JWT, e não `app_metadata.role`. Não foi substituído nem modificado nesta ronda.
- `claim_billing_shipments`, `configure_recurring_statements`, `reserve_recurring_statement` e `claim_recurring_invoice`: execução bloqueada a `anon` e `authenticated`, permitida a `service_role`.

### P01 — risco crítico confirmado e posteriormente corrigido

`public.increment_client_balance(uuid,numeric)` tem `SECURITY DEFINER`, execução efetivamente permitida a `PUBLIC`, `anon` e `authenticated`, e não valida sessão, empresa ou loja. O corpo publicado atualiza `audit_log.details.credit_limit` usando o cliente e o valor recebidos. A inspeção confirma a combinação insegura de privilégios e ausência de autorização; não foi executada uma alteração de saldo para demonstrar exploração.

A tentativa de consultar OpenAPI com uma chave pública recebeu HTTP 401 e não fornece evidência sobre exposição da RPC. A conclusão acima vem do catálogo PostgreSQL e da definição publicada, não dessa tentativa. Não foi chamado o endpoint da função de saldo.

Inicialmente foi preparada uma [proposta SQL](../supabase/audits/proposals/20261021_restrict_increment_balance.sql): revogar execução a `PUBLIC`, `anon` e `authenticated` e manter `service_role`. O único chamador encontrado no código é o webhook Stripe, que usa `createAdminClient()`. A proposta verifica os privilégios efetivos antes de confirmar a transação; não altera a fórmula nem os valores de saldo.

A correção recebeu posteriormente autorização expressa do utilizador e foi aplicada em 21/10/2026. A verificação atual não certifica a integridade financeira, a idempotência do webhook ou todos os downloads/APIs.

## P01 — verificação após aplicação

Foi aplicada a [migração de restrição](../supabase/migrations/20261021120000_restrict_increment_client_balance.sql), em transação, pela sessão administrativa já autorizada. A resposta da aplicação foi bem-sucedida e uma nova consulta independente ao catálogo confirmou:

| Âmbito | Execução antes | Execução depois |
| --- | --- | --- |
| PUBLIC | Sim | Não |
| anon | Sim | Não |
| authenticated | Sim | Não |
| service_role | Sim | Sim |

O [SQL de regressão apenas de leitura](../supabase/audits/20261021_balance_function_permissions_readonly.sql) não chama a função financeira. O hash da definição foi igual antes e depois: `981c65c3761e33c107c18c91fcc159a1`. A função conserva `SECURITY DEFINER`, mas os papéis públicos/de cliente já não têm permissão para a executar. O servidor Stripe mantém a permissão administrativa.

Não houve execução de `increment_client_balance`, alteração de saldos, cobranças, emissão de faturas ou pedidos a transportadoras. Não foi feito um pagamento real para testar o webhook. A correção está ativa na base publicada; não houve deploy da aplicação nem registo automático no histórico do Supabase CLI. A migração fica guardada e pode ser reaplicada sem alterar o resultado.
