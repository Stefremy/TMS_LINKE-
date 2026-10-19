# Estatísticas de faturação

Página: `/ops/faturacao/estatistica`.

## Fontes e acesso

Leitura exclusiva para colaboradores autenticados. Todas as consultas privilegiadas usam o `tenant_id` da sessão verificada. São lidas todas as páginas de `audit_log` (ações `billing_statement` e `custom_invoice`); os clientes vêm de `getClientesAction`. Os ciclos automáticos complementam a data de emissão e o vencimento através do payload original associado ao mesmo documento Moloni. Uma falha nos documentos não é transformada em faturação zero. Uma falha nos ciclos opcionais é apresentada na página.

Não são emitidas faturas, criados recibos, enviados emails ou alterados documentos por esta página. A atualização relê o TMS; não sincroniza o Moloni.

## Definições

- Cada `moloni_document_id` válido conta uma vez. O registo mais recente prevalece. Sem confirmação de emissão, pró-formas e documentos anulados ficam excluídos.
- Todos os valores são **sem IVA**, em cêntimos inteiros. Para transporte usa-se `total_value` do extrato associado à fatura. Para serviços avulsos usa-se `total_net`, ou `total_value - total_tax` se ambos estiverem guardados. O valor bruto nunca é usado como se fosse líquido.
- Liquidado: estado `paid`, ID de recibo ou PDF de recibo guardado. Um PDF igual ao da própria fatura (ou com o mesmo ID Moloni) não prova pagamento sem outra confirmação e aparece como recibo a confirmar.
- Por liquidar: valor sem confirmação de liquidação no TMS. Vencido: parte desse valor com vencimento guardado anterior à data atual em Lisboa. Vence hoje ainda não está vencido.
- Datas de vencimento em falta não são reconstruídas a partir das condições atuais do cliente. Aparecem no grupo sem vencimento.
- Datas de emissão: data guardada na fatura, data no payload automático, ou instante de emissão Moloni. Na falta destas usa-se a data de registo, identificada como tal na metodologia.
- O gráfico agrupa pelo **mês de emissão/registo** e mostra a liquidação atual dessa população; não representa entradas de dinheiro por data de pagamento.
- Pagamentos parciais e alterações realizadas apenas no Moloni podem não estar refletidos. Os totais representam os valores e estados guardados no TMS, sem substituir uma reconciliação bancária ou fiscal.

## Filtros e reconciliação

Período por emissão/registo, cliente e estado aplicam-se aos indicadores, gráfico, antiguidade, tabelas e CSV. O filtro por liquidar inclui as vencidas. O período inicial é o ano atual até hoje; pode escolher mês atual, todo o histórico ou datas manuais.

Faturado = liquidado + por liquidar para valores conhecidos. Vencido é subconjunto de por liquidar. Os grupos de antiguidade, clientes e meses reconciliam com os mesmos totais. Valores líquidos desconhecidos são explicitamente assinalados e excluídos dos totais monetários. As séries mensais incluem meses sem faturas, sem inventar pagamentos ou valores para faturas sem preço líquido conhecido.

Clientes são agrupados por ID. Faturas avulsas sem ID podem agrupar por NIF válido; NIF de consumidor final, nomes iguais e identidades ausentes não juntam clientes diferentes automaticamente.

## Validação

`node --test tests/billing-statistics.test.cjs` cobre valores líquidos/brutos, duplicados, documentos não fiscais, estados de liquidação, recibos ambíguos, datas e limites de antiguidade, filtros, exportação, paginação e isolamento por empresa. Está incluído em `npm run test:billing`.
