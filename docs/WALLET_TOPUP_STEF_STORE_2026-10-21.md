# Stef Store — carregamento de 1 € e saldo apresentado a zero

Investigação apenas de leitura em 21/10/2026, após o utilizador reportar um carregamento de 1 €.

## Confirmado

- A sessão Stripe correspondente ao carregamento mais recente de 1 € está concluída, com `payment_status=paid`, `amount_total=100` e moeda EUR. É um pagamento real, não uma sessão de teste. Os identificadores de loja/transação da metadata correspondem aos do TMS.
- A transação correspondente no TMS tem estado `paid`.
- O perfil atual da loja está em `pay_as_you_go`, com `credit_limit=202.50`.
- O histórico nativo tem 31 envios. A soma de `sell_price` dos não anulados é 329,93 €. A coluna `fuel_tax_amount` não existe no esquema publicado; o fetch atual não a devolve e o cálculo do portal trata a sua ausência como zero.
- O dashboard calcula crédito menos todos os envios não anulados da história, independentemente da data e da faturação: `202.50 - 329.93 = -127.43`.
- A interface aplica `Math.max(..., 0)`, pelo que mostra 0 € em vez de explicar o resultado negativo.
- Foram encontrados 19 extratos da loja, 16 com documento Moloni. Há 30 envios associados a extratos com marcador de liquidação, no valor nativo de 325,78 €. Esses marcadores não foram validados como prova de pagamento nem comparados integralmente com os PDFs/recibos; não justificam por si só excluir movimentos da wallet.

O zero no dashboard é explicado pelo cálculo atual mesmo com o crédito registado na base. Não foi recolhido um snapshot de crédito imediatamente anterior ao pagamento; `paid` no TMS, isoladamente, não prova que a etapa de crédito foi concluída, porque o webhook atual altera o estado antes de chamar a função de saldo e não reverte/reportaria erro HTTP se essa chamada falhasse.

## Antes de corrigir a regra financeira

Foi perguntado ao utilizador se os envios antigos eram de Conta Corrente/testes ou já de Pay As You Go. Não inferir a data de ativação da wallet a partir do timestamp do último perfil, nem apagar o histórico ou acrescentar dinheiro para compensar sem reconciliar os movimentos.

As faturas de envios genuinamente pré-pagos não devem devolver saldo automaticamente. É necessário distinguir eventual migração de Conta Corrente para wallet de faturação normal de consumos já pré-pagos.

## Âmbito

Não foram executados carregamentos adicionais, reenvios de webhooks, reembolsos ou chamadas de crédito. Não foram alterados saldos, transações, preços ou envios. As consultas ao Stripe e Supabase foram de leitura; nenhum segredo, link de checkout ou dado de cartão foi guardado neste relatório.
