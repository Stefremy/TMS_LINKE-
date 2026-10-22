# Correções Stripe, wallet e recibos — 22/10/2026

Implementação local autorizada após a reprodução dos problemas SW01–SW11 em [Stripe, wallet e recibos](STRIPE_WALLET_AUDIT_2026-10-22.md).

**Código e migração preparados; ainda não ativados nem verificados na base publicada.** Não foram alterados saldos de produção, enviados pagamentos, emitidos documentos fiscais ou criados envios reais. Sem commit, push ou deployment nesta ronda.

## Comportamento implementado

| Problemas | Correção |
| --- | --- |
| SW01–SW02 | `settle_stripe_topup` grava crédito, estado pago e marcador `credited_at` na mesma transação. Valida novamente empresa, cliente, sessão e montante, sob bloqueio do cliente e da transação. A assinatura é validada sobre o corpo original antes do acesso administrativo. Falhas devolvem 500 para permitir repetição. |
| SW03–SW05 | Checkout limitado à empresa autenticada e à própria loja para clientes. Montantes finitos em cêntimos, mínimo 1 €. Chave de idempotência por transação. O URL só é devolvido depois de guardar a associação à sessão; uma tentativa incompleta mantém referência para confirmação. |
| SW06–SW07 | `sell_price` é o total, incluindo combustível e extras. O recibo não constitui carregamento e não devolve consumo à wallet. Novos envios guardam o modelo de faturação no snapshot; os explicitamente feitos em Conta Corrente não são convertidos em consumo de wallet. |
| SW08 | Reserva SQL por cliente antes de criar o rascunho ou contactar a transportadora. Limite −2 € preservado. Consumo e reservas são calculados na mesma consulta SQL, sem intervalo entre leituras. Recusa confirmada liberta a reserva; timeout/resultado desconhecido mantém-na. A resposta aceite fica guardada para recuperação mesmo que falhe a gravação do envio. |
| SW09–SW11 | Ambas as ações manuais usam um serviço comum com permissão financeira, âmbito da empresa e associação ao extrato. A emissão usa o remanescente bruto confirmado na fatura Moloni. Uma tentativa persistida e um CAS permitem apenas um `insert`. O recibo é confirmado por ID, empresa, cliente, tipo RC, estado fechado, valor, marcador e associação à fatura antes de marcar o extrato como pago. |

A gravação da ficha do cliente também usa o bloqueio do cliente e compara o crédito esperado, para não substituir um carregamento que tenha ocorrido durante a gravação. Os novos RPCs só podem ser executados por `service_role`; as tabelas de reservas e transações de carregamento têm RLS e não permitem acesso direto a `anon`/`authenticated`.

## Recuperação sem duplicar

- **Stripe antigo:** uma transação já `paid` sem `credited_at` devolve `legacy_reconciliation_required`; não volta a creditar. Esse estado identifica necessidade de conferência, não prova falta de crédito.
- **Checkout incompleto:** não é exposto um URL sem associação persistida. Conferir a transação e o `client_reference_id`/metadata no Stripe antes de intervir; não reenviar cobranças nem alterar estados para forçar repetição.
- **Transportadora:** `submitted` significa que o resultado pode ser desconhecido. Não há expiração automática de reservas incertas. `consumed` sem envio persistido mantém o débito e a resposta em `wallet_reservations.result`. Conferir a operação antes de recuperar o registo ou libertar fundos; não criar outro envio como método de recuperação.
- **Preparação de recibo:** perder a resposta da gravação mantém o bloqueio financeiro. A recuperação retoma a mesma operação preparada e verifica que ainda detém esse bloqueio antes de contactar o Moloni.
- **Recibo:** repetir a consulta depois de uma falha recupera o mesmo documento por ID ou por uma linha única `TMS-RC-…` nas notas. A pesquisa percorre os recibos do cliente/data e confirma os candidatos individualmente. Pesquisa vazia ou múltipla mantém a incerteza; nunca provoca outro `insert`. Um recibo rascunho não marca a fatura como paga.
- **PDF ou arquivo:** ausência de PDF não elimina a existência do recibo. O ID e a tentativa confirmada permitem reparar o arquivo TMS sem emitir outro documento.
- **Notas de crédito:** recibos e notas de crédito partilham um bloqueio financeiro por fatura. Uma operação pendente impede a outra; a associação à fatura é novamente lida antes da preparação.

O campo `notes` do recibo está documentado pelo Moloni; o serviço não depende de um parâmetro de inserção `our_reference` não documentado. Referências: [receipts/insert](https://www.moloni.pt/dev/documents/receipts/insert), [receipts/getAll](https://www.moloni.pt/dev/documents/receipts/getall).

## Validação local

| Verificação | Resultado |
| --- | --- |
| `npm run test:finance` | 80 passaram: regressões Stripe/wallet/recibos, cálculo do saldo e 20 testes SQL |
| `npm run test:security` | 158 passaram, incluindo recusa da transportadora, timeout, reserva indisponível e falha de gravação após aceitação |
| `npm run test:billing` | 61 passaram |
| `npm run test:recurring` | 34 passaram |
| `npm run test:credit-notes` | 36 passaram |
| Total das baterias acima | 369 passaram |
| Build Next.js | Passou |
| Lint dos novos módulos/testes e do webhook/serviço de notas alterados | Passou |
| Lint dos ficheiros existentes alterados, comparado com HEAD | 172 → 152 erros; 24 → 24 avisos; nenhuma regra com aumento |
| Auditoria adicional de isolamento | 85 passaram / 8 falharam; as mesmas oito falhas também existem em HEAD |

Os testes SQL executam a migração real, incluindo reaplicação, numa base PostgreSQL isolada via PGlite. Verificam rollback depois da alteração de saldo, concessões/revogações, associações contraditórias, preços inválidos e conservação dos montantes. PGlite serializa numa ligação: não certifica contenção entre duas ligações de produção. Essa verificação e o esquema/RLS reais continuam necessários antes de fechar a ativação.

A bateria adicional `node --test tests/client-isolation-audit.test.cjs` não está totalmente aprovada: oito casos F03/F04 de rastreio esperam consultas/revalidações de propriedade que o percurso atual não realiza. Reproduzidas também com as versões HEAD dos módulos `app`/`lib` carregadas em memória, sem substituir os ficheiros do workspace. Não foram desativados esses testes, alterado o rastreio nem interpretadas essas asserções como prova de acesso efetivo a outra loja. Precisam de revisão própria. Os dois controlos de totais do portal foram atualizados para a RPC de saldo e para não duplicar combustível; continuam a verificar que o âmbito é a loja autenticada.

Os simuladores de aplicação foram atualizados para os contratos novos; os testes SQL são independentes desses simuladores. Os testes de preços continuam a usar os mesmos valores e fórmulas. Nenhuma chamada aos fornecedores foi feita por estes testes.

## Ativação e limites pendentes

1. Aplicar e verificar primeiro a [migração financeira](../supabase/migrations/20261022180000_atomic_wallet_operations.sql) num ambiente de validação. Não exige backfill de saldo nem classifica pagamentos antigos como creditados.
2. Confirmar privilégios, perfil financeiro e esquema nesse ambiente. Executar concorrência com duas ligações PostgreSQL independentes e um pagamento Stripe de teste, incluindo repetição/falha. Recibos devem ser validados em sandbox Moloni.
3. Aplicar a migração na base publicada antes de publicar o código dependente. O webhook novo falha com 500 se a migração não existir; reservas e gravação de fichas falham de forma explícita. Não publicar apenas o código.
4. Publicar e conferir os fluxos em ambas as áreas. Confirmar que os webhooks passam pela versão nova durante a transição. Os testes locais não certificam o deployment.
5. Usar a [consulta administrativa de verificação](../supabase/audits/20261022_financial_operations_readonly.sql), após a migração, para identificar operações pendentes. A consulta não corrige nem movimenta dinheiro.
6. Reconciliar separadamente pagamentos históricos e períodos em que uma loja possa ter mudado de Conta Corrente para wallet. Envios antigos sem modelo explícito mantêm a necessidade de apurar a origem; não foi inventada uma data de ativação nem um saldo de abertura. O saldo calculado pode diferir do cálculo antigo incorreto; nenhum crédito compensatório é aplicado automaticamente.

O Passo 4 tem estas correções implementadas, mas continua aberto quanto à ativação, reconciliação histórica e demais percursos financeiros não abrangidos por SW01–SW11.
