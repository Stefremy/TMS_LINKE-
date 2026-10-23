# Ajuste automático por peso da transportadora

Implementado para cumprir a opção escolhida: ajustar automaticamente os envios ainda não faturados e refletir a diferença no saldo Pay As You Go.

## Funcionamento

- A criação de um novo envio guarda `weight_pricing_basis` no snapshot `shipment_data`: zona, escalões, preços personalizados e taxa de combustível efetivamente usados. Não inclui credenciais nem contactos.
- O sincronismo habitual CTT/Correos e a consulta manual de medições tentam reconciliar o peso no servidor, quando a funcionalidade está ativa.
- O preço resulta do escalão que contém o peso comunicado. Um salto de 1 kg para 6 kg pode ultrapassar vários escalões; não avança apenas uma linha da tabela.
- Recalcula transporte, combustível e custo de compra com a tabela original. Preserva os extras já contratados. Não altera o peso/dimensões declarados, etiquetas ou o pedido enviado à transportadora.
- Se não houver aumento de preço, não faz nova cobrança. Leituras inferiores não emitem créditos automáticos.
- Cada ajuste grava o peso de cobrança separado em `billing_weight_kg`, um novo snapshot de preços e o evento `shipment_weight_adjustment`, com antes/depois e ligação à medição.
- OPS e Área do Cliente mostram o ajuste, o peso usado na cobrança, o preço anterior e o preço corrigido no painel de pesos e medidas.

## Saldo e faturação

A wallet usa o total canónico dos envios. O ajuste atualiza esse total; **não** volta a debitar `credit_limit`, não cria carregamentos e não chama Stripe. Assim, o saldo baixa apenas pela diferença. Se o envio já realizado gerar dívida, o saldo pode ficar negativo; novas reservas continuam a respeitar o limite da wallet. Conta Corrente mantém o preço corrigido para faturação, sem criar débito numa wallet.

A transação SQL partilha o bloqueio do cliente com reservas/carregamentos e o bloqueio de período com a faturação. Uma falha no histórico faz rollback de todo o ajuste. Um snapshot/medição desatualizado ou uma repetição não volta a cobrar.

Não altera preços de envios já associados a documentos ou extratos, nem com emissão fiscal em curso. A emissão manual valida o preço carregado dentro da mesma transação da reserva de faturação, antes de contactar Moloni; se mudou, exige atualização da página. Os documentos anteriores são preservados.

## Limites de confiança

- CTT: `_PesoReal` continua guardado tal como recebido. A conversão exige `CTT_MEASURED_WEIGHT_UNIT=g` ou `kg`, **apenas depois de confirmação da unidade pelos CTT**. Nenhuma unidade é presumida por tamanho do número.
- Correos: `kilos` é usado em kg segundo a regra de automatização solicitada. A API não certifica se é peso declarado ou uma pesagem física; essa limitação continua visível.
- Envios com vários volumes ficam para revisão enquanto não estiver confirmado que a leitura corresponde ao peso total.
- Dimensões e peso volumétrico não desencadeiam correções nesta versão: faltam unidades/divisores contratuais confirmados.
- Envios históricos sem a base tarifária original ficam para revisão no OPS. Não reconstrói preços antigos a partir da tabela atual.
- Tarifas ausentes, valores inconsistentes, pesos fora da tabela ou falhas de base de dados preservam o preço e devolvem um aviso na consulta manual.

## Ativação

A funcionalidade fica desativada por omissão. Não foi aplicada nenhuma correção a dados reais durante o desenvolvimento.

1. Aplicar `supabase/migrations/20261023160000_carrier_weight_adjustments.sql` no projeto correto, depois das migrações de faturação e wallet existentes. A migração cria funções e índice; não altera saldos ou envios.
2. Publicar o código juntamente com a migração.
3. Configurar `CARRIER_WEIGHT_REPRICING_ENABLED=true` no servidor local/publicado e reiniciar/republicar. A Correos pode então reconciliar novos envios com base tarifária guardada.
4. Para CTT, configurar também `CTT_MEASURED_WEIGHT_UNIT` com a unidade confirmada. Enquanto estiver vazio, os ajustes CTT ficam bloqueados.
5. Fazer o primeiro teste com envio controlado criado após esta alteração. Verificar peso declarado, peso de cobrança, diferença, saldo e histórico. Repetir sincronismo e confirmar que o saldo não muda novamente.

Se a migração estiver ausente, a gravação financeira falha sem alterar o saldo; o tracking continua disponível. Não ativar a flag antes de aplicar a migração, pois a emissão manual passa a depender da nova validação de preços.

## Validação

- `tests/carrier-weight-pricing.test.cjs`: escalões, combustível, extras, preços personalizados, tarifário congelado, unidades, evidência e isolamento.
- `tests/carrier-weight-adjustment-sql.test.cjs`: executa PL/pgSQL em PostgreSQL isolado (PGlite), com wallet real, rollback, permissões, documentos, repetição e integração do motor com leituras CTT e Correos.
- PGlite usa uma ligação serial: testa restrições/transações e a idempotência, mas não substitui o teste de concorrência com duas ligações num PostgreSQL antes da ativação em produção.
- Regressões: wallet/Stripe, isolamento, medições, faturação manual/recorrente e segurança, mais TypeScript/build/lint direcionado.
