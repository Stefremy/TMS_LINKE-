# Preços personalizados dos clientes — 14/10/2026

## Comportamento

- «Tabelas de envio ativas» identifica as tabelas utilizadas nos novos envios. Os preços negociados em «Ajustar Preços» passam a ser respeitados ao gravar e emitir o envio, tanto no portal do cliente como em Ops.
- A pedido do utilizador, o separador antigo «Tarifas por Escalão» / «Tarifas antigas» foi removido do modal, juntamente com a tabela e os seus handlers. Os dados antigos já guardados são preservados, incluindo ao repor os preços ativos, e não determinam o preço dos novos envios.
- O cálculo é preço do escalão (personalizado quando configurado), combustível e serviços especiais selecionados. Não é aplicado desconto percentual adicional, por indicação do utilizador. Valores de desconto já guardados não foram apagados.
- O formulário e o servidor partilham o cálculo. Depois da emissão, o ecrã usa o preço confirmado pelo servidor. O servidor continua a carregar o perfil do cliente e o serviço autorizado a partir dos dados persistidos; preços enviados pelo navegador não são autoridade.
- A personalização atual corresponde à primeira zona da tabela, a única zona editada pelo modal existente. O modal identifica essa zona. Outras zonas mantêm os preços da tabela Linke; a personalização continental não é reutilizada em Espanha ou nas ilhas.
- O escalão de kg adicional soma o preço do último escalão base e os kg adicionais, incluindo o custo do parceiro. Os escalões internacionais oficiais mantêm incrementos de 0,5 kg; os restantes usam 1 kg por defeito.
- Destinos ou pesos sem tarifa configurada e preços personalizados inválidos impedem a emissão antes de contactar a transportadora.

## Exemplo

Um escalão negociado de 6 € com combustível de 12,5% resulta em 6,75 €, antes dos serviços especiais. Cobrança de 100 € a 2% e tratamento frágil de 1,50 € elevam o total a 10,25 €. O preço padrão da tabela e o custo do parceiro não são alterados pelo preço negociado.

## Verificação

Testes isolados, sem rede e com transportadoras e base de dados simuladas, cobrem CTT e Correos: preços persistidos, tentativas de forjar valores, isolamento entre clientes e empresas, ordem dos escalões, escalões desativados, zonas, quilos adicionais, mínimos e arredondamentos de serviços especiais e criação de rascunhos. O conjunto de segurança passou com 118 testes.

`npx tsc --noEmit` e `npm run build` passaram. ESLint passou no calculador partilhado, no módulo de suplementos, nos tipos de escalão, nas zonas internacionais e nos testes. Os formulários e ações existentes ainda têm ocorrências anteriores de lint, pelo que não se declara o projeto inteiro limpo. A interface do modal foi verificada no navegador, sem gravar o cliente.

Não foram criados envios reais, alterados saldos, enviadas mensagens ou modificadas tabelas de clientes na base de dados para testar esta alteração. Envios históricos não são recalculados.
