# Tarifa ibérica e pré-visualização — 26/10/2026

O serviço `srv_linke_eq_std` («Ctt expresso ibérico #») autorizava apenas
`ES-PENIN`, mas a sua única matriz de preços estava em `PT-CONT`. O código
postal 28013 não encontrava tarifa. A categoria «Ibérico» não altera a zona
da matriz de preços.

Após confirmação explícita do utilizador, foi guardado no Supabase um novo
snapshot `servicos_linke_data`, na mesma empresa, com a zona `ES-PENIN` e o
nome «Espanha Peninsular». O snapshot anterior foi preservado. Não foram
alterados preços, custos, combustível, escalões ou permissões de destino.

Valores confirmados pelo cálculo autoritativo para ES / 28013, sem serviços
adicionais ou preços personalizados, e sem IVA:

| Peso | Base | Combustível (12,5%) | Total |
| --- | ---: | ---: | ---: |
| Até 1 kg | 6,21 € | 0,78 € | 6,99 € |
| Mais de 1 kg e até 5 kg | 7,51 € | 0,94 € | 8,45 € |

Acima de 5 kg continua a não existir escalão configurado.

Foi também corrigido localmente um erro independente: o portal recebia
corretamente os preços com custos e margens ocultos, mas tentava validá-los
como uma tabela interna completa. A pré-visualização passa a usar apenas
os preços de venda publicados e as mesmas regras de escalões, preços
personalizados, combustível e serviços adicionais. A emissão no servidor
mantém a tabela completa e o cálculo autoritativo. Uma tarifa indisponível
passa a mostrar a razão, em vez de apresentar um total de 0,00 €.

Validação: TypeScript passou; 62 testes de segurança passaram, incluindo
paridade de preços CTT/Correos com custos ocultos e rejeição de uma zona
sem tarifa. O teste de quilos adicionais também passou com a nova
pré-visualização. Os problemas de lint já existentes no formulário não
aumentaram; o módulo novo passou no lint.

A configuração da zona já está guardada no Supabase. A correção de código
precisa de publicação para chegar ao site publicado. Não foram emitidos
envios, documentos fiscais ou chamadas a transportadoras, nem alterados saldos.
