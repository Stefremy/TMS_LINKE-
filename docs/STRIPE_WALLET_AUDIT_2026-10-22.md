# Stripe, wallet e recibos — verificação de 22/10/2026

## Estado atual

SW01–SW11 foram autorizadas e corrigidas no código local. A validação atual tem 369 testes aprovados e build aprovado; a migração e o código ainda não foram ativados nem verificados na base publicada. Reconciliação histórica permanece separada, sem recreditar pagamentos automaticamente. [Implementação, testes e ativação](FINANCIAL_CORRECTIONS_2026-10-22.md).

O restante documento conserva o diagnóstico inicial anterior às correções, incluindo os seus resultados e limites.

## Âmbito e resultado inicial

Base analisada: `acd0992`. Verificação do ponto 1 da lista de prioridades antes da entrega a clientes: carregamentos Stripe, saldo, concorrência e repetição de recibos.

**Estado no diagnóstico inicial: não aprovado para dar esta área por concluída.** A bateria nova tem **36 testes: 14 controlos passaram e 22 casos reproduziram problemas**, agrupados em SW01–SW11. As falhas exprimem o comportamento seguro esperado; não foram desativadas nem adaptadas para aceitar o comportamento atual.

Na fase inicial só foram acrescentados testes, este relatório, a referência no plano e um comando de reprodução. Não houve correção da aplicação, migração, consulta de dados de produção, alteração de saldo, cobrança, emissão fiscal ou chamada a transportadoras. Não houve commit, push ou deployment.

## Método

- Execução dos módulos TypeScript reais pelo carregador existente do projeto.
- SDK Stripe real para gerar e verificar assinaturas de payloads locais; chave de assinatura exclusivamente fictícia. Checkout e base de dados simulados, sem rede.
- Simulação de transações, perfis de saldo, falhas de escrita e entregas simultâneas/repetidas.
- A RPC simulada reproduz o efeito do SQL guardado no repositório: atualizar perfis `client_data`, incluindo a possibilidade de zero linhas atualizadas sem erro. Não certifica o corpo ou os privilégios atualmente publicados.
- Cálculos reais de `client-balance.ts` e criação real de rascunhos pelo serviço, com preços, sessões e base fictícios.
- Emissão de recibos com o helper Moloni real e as ações reais, substituindo apenas os pedidos ao fornecedor e a base por simuladores.

## Resultados

| Comando | Resultado |
| --- | --- |
| `npm run test:stripe-audit` | 36 casos; 14 passaram, 22 falharam; saída 1 esperada nesta fase de diagnóstico |
| `node --test tests/client-balance.test.cjs` | 6/6 passaram; estes testes anteriores não cobrem todos os invariantes financeiros novos |
| `npx eslint tests/stripe-wallet-audit.test.cjs` | Passou |
| `git diff --check` | Passou |

Não foi repetido o build: esta ronda não alterou código da aplicação Next.js. O comando de auditoria fica separado das baterias existentes enquanto as correções aguardam decisão, conforme o método do plano.

## O que já funciona nos controlos testados

- Um pagamento EUR válido é creditado no percurso normal.
- Assinatura em falta, errada, corpo alterado e timestamp expirado são recusados antes do acesso administrativo à base.
- A conclusão de Checkout ainda não pago aguarda confirmação; o evento assíncrono de pagamento consegue creditar.
- Repetições e entregas simultâneas do pagamento normal não duplicam o crédito.
- Um evento de falha recebido depois do pagamento concluído não desfaz o saldo.
- Uma falha ao atualizar a transação devolve erro recuperável e não credita.
- Um cliente não consegue iniciar carregamento para outra loja; o checkout próprio normal guarda o valor e a sessão.
- Um único rascunho respeita o limite de descoberto da amostra.
- O helper de recibos faz um único pedido no sucesso normal e uma fatura com PDF de recibo guardado bloqueia a repetição.

## Problemas reproduzidos

| ID | Prioridade | Evidência na simulação |
| --- | --- | --- |
| SW01 | Crítica | A transação passa a `paid`; falha o crédito; o webhook responde 200. A repetição não credita porque a transação já não está `pending`. Também considera concluída uma RPC que não encontrou perfil a atualizar. |
| SW02 | Alta | Eventos com assinatura válida, mas cliente, empresa, sessão, montante ou moeda contraditórios com a transação, são processados sem validar essas correspondências. |
| SW03 | Alta | Uma sessão de colaborador da empresa A inicia checkout para um cliente da empresa B, porque a consulta valida apenas o ID do cliente. |
| SW04 | Média | `NaN`, infinito e valores com frações de cêntimo chegam à tentativa de escrita antes de serem recusados ou arredondados no checkout. |
| SW05 | Alta | A falha ao guardar `stripe_session_id` é ignorada e é devolvido sucesso com o URL do checkout. |
| SW06 | Alta | O combustível já incluído em `sell_price` volta a ser somado no cálculo do saldo e da dívida. Um envio com total 4,15 € e combustível 0,46 € conta como 4,61 €. |
| SW07 | Alta / regra a reconciliar | Para envios já pré-pagos, adicionar apenas um recibo ao extrato faz a wallet subir sem novo carregamento. Na amostra, passa de 6 € para 10 €. |
| SW08 | Alta | Duas criações simultâneas de rascunhos leem o mesmo saldo antes de escrever. Com 1 € de saldo, aceitam dois rascunhos de 3 €: o saldo conjunto fica em −5 €, abaixo do limite de −2 €. |
| SW09 | Alta | Se a resposta do primeiro `receipts/insert` se perder depois da criação fiscal, o helper envia outro `insert`, agora como rascunho. A simulação produz um recibo fechado e outro rascunho. |
| SW10 | Alta | Duas emissões manuais simultâneas enviam dois pedidos de recibo. Um ID de recibo guardado sem PDF também não bloqueia a repetição; falhar o arquivo depois da criação permite novo pedido. |
| SW11 | Alta | O recibo manual comum usa o valor TMS sem IVA, sem consultar o remanescente da fatura Moloni. Para uma fatura de 12,30 € com base de 10 €, envia um recibo de 10 € e marca o extrato como pago. |

### SW01 — gravação de pagamento e crédito separados

Local: [webhook Stripe](../app/api/webhooks/stripe/route.ts), atualização `pending → paid` seguida da chamada a `increment_client_balance`.

O primeiro passo e o crédito são operações distintas. Quando a RPC falha, o código apenas regista o erro e continua até à resposta 200. Na reprodução, um pagamento fictício de 10 € fica `paid`, com saldo 0 €; a repetição mantém saldo 0 €.

A correção precisa de um processamento atómico e idempotente: validar/bloquear a transação, confirmar o destino e valor, atualizar o saldo e guardar a conclusão na mesma transação SQL. Uma alternativa com fila precisa de guardar duravelmente o trabalho antes do reconhecimento e distinguir pagamento confirmado de saldo creditado. Apenas inverter a ordem das duas operações desloca o risco para crédito duplicado.

### SW02–SW05 — ligação entre checkout e transação

Locais: [ação de carregamento](../app/actions/stripe.ts) e [webhook](../app/api/webhooks/stripe/route.ts).

**Limite importante da SW02:** os eventos contraditórios foram assinados com a chave fictícia do teste. Isto demonstra ausência de validação de integridade após a assinatura; não demonstra que um cliente consegue falsificar uma assinatura Stripe ou editar diretamente metadata de uma sessão no fornecedor.

É necessário verificar a sessão esperada, cliente e empresa da transação guardada, `mode`, moeda EUR e valor exato em cêntimos. O destino do crédito deve vir do registo validado, não apenas de metadata. A associação à sessão deve ficar persistida ou com recuperação explícita se a gravação falhar. A criação do checkout deve também limitar o cliente à empresa da sessão autenticada e recusar valores inválidos antes de escrever.

### SW06–SW08 — saldo e consumo

Locais: [cálculos de saldo](../lib/billing/client-balance.ts), [preço do envio](../lib/pricing/calculate-shipment-price.ts), [criação de rascunhos](../lib/services/shipments/shipment-creator.ts) e validação em `emitClientGuiaAction`.

O cálculo do preço já devolve o combustível dentro de `sellPrice`. O helper de saldo volta a somar `fuel_tax_amount`; os controlos de criação também voltam a somá-lo ao custo avaliado.

A SW07 exige reconciliar a origem dos movimentos: um recibo de consumo previamente pago pela wallet não é um novo carregamento. Se existir outro pagamento efetivo fora da wallet ou uma migração de Conta Corrente, deve haver um movimento/regra explícito. Não se deve excluir indiscriminadamente todo o histórico faturado nem alterar saldos antigos sem reconciliação.

A SW08 foi executada no percurso real de criação de **rascunhos**, com base simulada. O percurso que contacta transportadoras apresenta também uma leitura de saldo antes da chamada externa e posterior gravação, mas não foi emitido um envio real para o testar. É necessária reserva atómica de crédito antes de confirmar operações externas, com recuperação definida para recusa confirmada e resultado desconhecido.

### SW09–SW11 — recibos

Locais: `MoloniClient.createReceipt`, em [moloni-client.ts](../lib/moloni/moloni-client.ts), e `emitMoloniReceiptForStatementAction`, em [moloni.ts](../app/actions/moloni.ts).

Um timeout não permite concluir que o primeiro documento não foi criado. O fallback atual cria outro documento e pode devolver o ID desse rascunho. É preciso guardar a tentativa antes da chamada, impedir pedidos concorrentes e reconciliar por referência/ID antes de qualquer repetição. Um PDF em falta deve ser recuperado a partir do recibo existente.

O valor a liquidar deve ser lido na fatura Moloni e o estado confirmado antes de apresentar o extrato como totalmente pago. Os percursos após nota de crédito e de faturação periódica já fazem consultas específicas; a falha SW11 está no percurso manual comum, sem esses marcadores.

## Ordem proposta para correção, uma de cada vez

1. **SW01 junto das validações SW02:** processamento atómico/idempotente do carregamento, com testes de falha e repetição. Preparar migração protegida para execução exclusiva pelo backend e teste de integração SQL. Não reenviar pagamentos históricos automaticamente.
2. **SW03–SW05:** âmbito da criação de checkout, montantes e gravação/recuperação da sessão.
3. **SW06–SW07:** estabelecer a regra financeira e a origem dos movimentos; corrigir a dupla contagem sem recalcular automaticamente saldos históricos.
4. **SW08:** reserva atómica e recuperação do crédito usado por envios concorrentes.
5. **SW09–SW11:** recibos com tentativa persistida, emissão única, valor bruto remanescente e confirmação fiscal.

## Limites e documentação externa

Não foram usados pagamentos, chaves Stripe reais, SQL administrativo ou dados comerciais. Os testes não executam RLS, constraints PostgreSQL ou uma transação SQL real e não certificam o esquema atualmente publicado. Na SW08 não foram testadas proteções adicionais que possam existir apenas na base publicada. Na SW10 confirmam-se pedidos duplicados no TMS; a aceitação de ambos pelo Moloni real depende das validações do fornecedor.

Não há evidência nesta ronda de perda real de fundos, exploração por terceiros ou de que a SW01 tenha causado o incidente anterior do carregamento de 1 €. As correções não devem creditar automaticamente transações antigas marcadas como pagas: é necessário apurar quais foram efetivamente creditadas.

A [documentação oficial Stripe](https://docs.stripe.com/webhooks#event-delivery-behaviors) confirma que os eventos podem repetir-se, chegar fora de ordem e ser reenviados após falha. O tratamento precisa de ser idempotente; o reconhecimento deve corresponder a processamento concluído ou trabalho duravelmente registado. A assinatura verifica a origem do evento, não substitui a correspondência entre os seus dados e a transação interna.
