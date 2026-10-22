# Combustível — EXT-2026/10-1425, documento Moloni n.º 28

Verificação de leitura em 22/10/2026. Foram comparados o snapshot do extrato, os registos nativos de envios, os snapshots originais `shipment_data` e o PDF Moloni existente. O PDF identifica a série como `FT M/28`; a referência comunicada na interface foi `FT 2026/28`.

| Envio | Base original | Combustível original | Venda original |
| --- | --- | --- | --- |
| LTK1190418 | 3,48 € | 0,43 € | 3,91 € |
| LTK1044749 | 3,69 € | 0,46 € | 4,15 € |
| LTK1881506 | 3,69 € | 0,46 € | 4,15 € |
| Total | 10,86 € | 1,35 € | 12,21 € |

Os montantes acima vêm dos valores guardados nos snapshots dos envios, não de uma recomposição com uma percentagem atual. Não há `fuel_rate_pct` nesses snapshots, portanto não se deve atribuir retroativamente uma percentagem histórica por suposição.

## Resultado

O PDF apresenta uma única linha agrupada para três envios de CTT Económico / 48 — Continente: 12,21 € antes de IVA, 2,81 € de IVA a 23% e 15,02 € a pagar. Não existe linha separada de combustível nem percentagem. O valor de combustível de 1,35 € já está incluído nos 12,21 €; não deve ser somado novamente.

Há dois pontos no código:

1. O modo agrupado da emissão Moloni soma `sell_price` por serviço e não discrimina combustível.
2. Os três registos nativos e o snapshot emitido guardam o preço de venda mas não a base/combustível que existem nos snapshots originais. `internalEmitInvoice` substitui a seleção da interface pelos registos nativos autorizados e perde essa discriminação. Escolher apenas o modo detalhado não garante a correção destes dados antigos.

A futura correção deve recuperar os valores históricos de fontes autorizadas da mesma empresa/loja/envio, conservar o total cobrado e separar base, combustível e extras sem duplicações. Não aplicar uma percentagem atual a faturas antigas nem adotar o fallback genérico de 12,5% como evidência histórica.

Não houve alteração de preços, migrações, emissão, reemissão, anulação ou substituição do documento fiscal. O PDF foi apenas descarregado para ficheiro temporário local e inspecionado; o URL privado e os dados pessoais não foram copiados para este relatório.

## Correção autorizada — combustível e suplementos

Após o diagnóstico, o utilizador autorizou a separação do combustível e pediu também os serviços da tabela de taxas suplementares. A implementação local passa a:

- Construir linhas comuns para faturação manual agrupada/detalhada, pró-forma e faturação automática: transporte, combustível e cada suplemento identificado nos valores históricos.
- Recuperar campos financeiros ausentes dos snapshots `shipment_data`, sempre por empresa, loja e ID do envio já autorizado, com paginação e sem carregar etiquetas. O preço da snapshot tem de coincidir com o preço atual autorizado; dados antigos não substituem o total, a identidade ou valores atuais já presentes.
- Trabalhar em cêntimos e exigir que a soma das componentes corresponda ao preço guardado. Se base, combustível e suplementos forem incompatíveis com o total, a preparação termina com erro antes da inserção fiscal. Se não existir discriminação histórica, mantém-se o total existente sem inventar combustível.
- Separar extras por nome e valor quando o JSON guardado permite reconciliar exatamente o montante de suplementos. Descrições ausentes/malformadas ou com soma incompatível mantêm uma única linha genérica com o montante de suplementos já registado, sem inventar uma repartição.
- Mostrar a percentagem de combustível apenas quando ela está guardada. Não aplicar a taxa atual da ficha a envios antigos.
- Preservar os campos recuperados nos novos snapshots manuais de extratos. Os documentos já emitidos são devolvidos sem reconstrução/reemissão, mesmo que o seu PDF esteja temporariamente indisponível.

A leitura real dos três envios do exemplo, usando o novo recuperador e construtor em modo de pré-visualização, produziu as linhas 10,86 € + 1,35 €, com o mesmo total de 12,21 € sem IVA. Não foi chamado nenhum método de emissão Moloni nessa verificação.

### IVA e arredondamentos

A taxa de IVA configurada continua a ser passada ao Moloni. A garantia de reconciliação implementada é sobre o total **antes de IVA**. Separar linhas pode afetar cêntimos de IVA quando a empresa está configurada para arredondar por linha, em vez de ao total do documento. A configuração Moloni não foi consultada nem alterada nesta correção, e não se promete invariância do total com IVA para todos os métodos. No exemplo analisado, ambas as repartições dão 2,81 € de IVA a 23%.

Referências primárias: [métodos de cálculo Moloni](https://www.moloni.pt/suporte/como-funciona-o-metodo-de-calculo-nos-valores-dos-documentos) e [configuração do arredondamento](https://www.moloni.pt/suporte/escolher-o-metodo-de-calculo-para-arredondamento-dos-valores).

### Verificação

- Antes da alteração da ação, o novo teste de emissão agrupada devolvia uma única linha de 6,50 €, em vez de 4,00 € de transporte + 0,50 € de combustível + 1,50 € e 0,50 € de extras.
- O teste passa após a correção e confirma que o extrato novo conserva os campos de combustível/suplementos.
- Casos puros cobrem agrupado/detalhado, vários serviços, percentagens históricas distintas, extras por nome, zeros, valores negativos/inválidos, descrições antigas/malformadas, totais incompatíveis, preços antigos e isolamento da recuperação por empresa/loja.
- Casos de emissão simulada cobrem a emissão manual, a automática e a recusa de reconstruir um documento já emitido sem PDF.
- O carregador da auditoria de isolamento recebeu o mock da dependência de destino do portal introduzida anteriormente no checkout Stripe; o controlo de checkout próprio estava a falhar por essa dependência de teste ausente, sem alteração ao código Stripe nesta correção.

Não houve migração, escrita de dados financeiros reais, emissão, reemissão, anulação de faturas, emails, commit, push ou deployment. Todas as chamadas de emissão nos testes foram simuladas. As alterações precisam de publicação para afetar novas emissões no site.

Resultados finais: `npm run test:billing` — 53 passaram; `npm run test:recurring` — 34 passaram; `npm run test:security` — 138 passaram; auditoria de isolamento — 93 passaram. Build com TypeScript e ESLint dos novos módulos/testes passaram; `git diff --check` sem erros. Não representa lint global limpo dos ficheiros antigos.


## Apresentação do extrato TMS

Em 22/10, o gerador do PDF passou a mostrar apenas o total dos extras na linha principal do envio. Os nomes completos e os respetivos valores aparecem numa lista abaixo desse envio, com quebra de linhas e continuação identificada noutra página quando necessário. A discriminação individual só mostra preços que reconciliam com o total guardado; dados antigos inconsistentes conservam o total sem inventar valores por opção. Os cálculos monetários e a emissão Moloni não foram alterados nesta revisão visual.

Validação: 58 testes de faturação aprovados, incluindo preservação dos valores, descrições longas, 70 suplementos e paginação; exemplos renderizados e revistos visualmente. Exemplo demonstrativo sem valor fiscal em `output/pdf/extrato-taxas-adicionais-exemplo.pdf`. Alteração local, sem emissão de documentos reais ou alterações na base de dados.
