# Testes de discriminação — GO Linke

Criados em 22/10/2026, a pedido do utilizador, na conta GO Linke. Referências `TESTE-GL-20261022-01` a `06`, estado **Cancelado**, sem etiquetas, referências de transportadora, faturas ou recibos. Não reativar nem faturar estes registos.

Tarifa existente: Ctt espresso Económico / 48 — Continente (`srv_linke_eq_std`), combustível 12,5%. Nenhum preço ou configuração de cliente foi alterado. Contactos omitidos e moradas fictícias identificadas como teste. O seguro reproduz o cálculo atualmente configurado; não representa uma contratação de seguro.

## Pré-visualização dos valores sem IVA

| Referência | Cenário | Peso | Transporte | Combustível | Extras | Total |
|---|---|---:|---:|---:|---:|---:|
| TESTE-GL-20261022-01 | Base | 0.5 kg | 3,48 € | 0,43 € | 0,00 € | 3,91 € |
| TESTE-GL-20261022-02 | Frágil | 1.5 kg | 3,69 € | 0,46 € | 1,50 € | 5,65 € |
| TESTE-GL-20261022-03 | SMS | 3 kg | 3,69 € | 0,46 € | 0,15 € | 4,30 € |
| TESTE-GL-20261022-04 | Seguro | 5 kg | 3,69 € | 0,46 € | 3,50 € | 7,65 € |
| TESTE-GL-20261022-05 | Cobrança 100 EUR | 2 kg | 3,69 € | 0,46 € | 2,00 € | 6,15 € |
| TESTE-GL-20261022-06 | Frágil + SMS + seguro | 8 kg | 4,06 € | 0,51 € | 5,15 € | 9,72 € |

O último cenário tem dois volumes de 5 kg e 3 kg. A cobrança de 100 € é apenas um valor de teste; o suplemento calculado é 2 €, sem qualquer movimento monetário.

## Linhas previstas numa emissão agrupada (simulação)

| Linha | Valor sem IVA |
|---|---:|
| Serviço Ctt espresso Económico / 48 — Continente (6 envios) | 22,30 € |
| Taxa de Combustível (12,5%) | 2,78 € |
| Serviço especial — Fragil (Tratamento Diferenciado Frágil) | 3,00 € |
| Serviço especial — SMS / LiveTracking (Alerta SMS e Seguimento em Tempo Real) | 0,30 € |
| Serviço especial — SpecialInsurance (Seguro Extra de Valor Declarado) | 7,00 € |
| Serviço especial — AgainstReimbursement (Cobrança / Reembolso - COD) | 2,00 € |
| **Total** | **37,38 €** |

Pré-visualização calculada com o construtor real de linhas, sem chamar o Moloni. Nenhuma fatura foi emitida. Não valida o arredondamento fiscal do Moloni nem a aceitação destes extras pelos CTT.

## Verificação após gravação

- 6 linhas nativas em `shipments`, 6 snapshots `shipment_data` e 7 volumes em `packages`, todos na GO Linke e no seu tenant.
- Valores financeiros relidos do Supabase e recuperados pelo mesmo helper usado na faturação; transporte + combustível + extras = total de cada envio.
- 0 destes registos selecionados pelo filtro atual de tracking em lote.
- 0 destes registos elegíveis no seletor atual de faturação recorrente.
- Sem alterações a saldos, documentos fiscais ou outros envios.

Para consultar: OPS → Envios → pesquisar `TESTE-GL-20261022`, incluindo o estado Cancelado. As grelhas operacionais podem usar contagens/pesos simplificados; a tabela acima e os registos `packages` refletem os pesos verificados. Não selecionar para faturação manual.

## Identificadores para remoção futura

Correção local em 22/10: Contas Correntes incluía os testes cancelados como pendentes de faturação. O RPC `claim_billing_shipments` recusava-os corretamente pelo estado, mas a aplicação apresentava a mensagem genérica de envios já faturados/emissão por confirmar. Confirmado por leitura: os seis testes não têm `billing_statement_id` nem reservas em `billing_emission_claims`. A página passou a excluir cancelados/anulados/rascunhos, e a emissão manual verifica o estado persistido antes de contactar o Moloni. Não foram removidas reservas nem alterados estados. Testes cobrem o filtro da página e um pedido com estado pendente forjado contra um registo cancelado. Esta correção precisa de publicação para aparecer no site de produção.

- TESTE-GL-20261022-01: `2134ee56-59f3-45c3-9d34-a66300d624d8`
- TESTE-GL-20261022-02: `8da5ca08-01f6-4b9f-b62f-1ecc31c022c5`
- TESTE-GL-20261022-03: `f7b1e55f-778c-43a2-af63-7b6233b1fa00`
- TESTE-GL-20261022-04: `168a5339-b292-45c3-a515-a685b1894ffc`
- TESTE-GL-20261022-05: `6b1c2653-b406-4f91-ae27-1a30937ed232`
- TESTE-GL-20261022-06: `074f03f1-d645-42ad-9dc4-deabd97fe36f`
