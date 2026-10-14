# Identificação dos serviços CTT nas tabelas

A tabela EQ existente estava configurada com `ENCF008.01`, mas tinha o nome editável «Ctt espresso #». A interface agora identifica o produto CTT pelo código configurado, independentemente do nome comercial da tabela.

| Código configurado | Identificação visível |
| --- | --- |
| ENCF008.01 | Guia EQ · Económico 48 |
| EMSF056.01 | Guia DD · Para Amanhã |
| EMSF057.01 | Guia DB · Em 2 Dias |

O EQ usa um distintivo âmbar, o DD verde e o DB azul, sempre com texto. A identificação aparece nos cartões e no detalhe de Serviços & Tabelas de Preço, no editor do serviço, no modal do cliente e nos seletores de serviço dos formulários de envio. Só é mostrada para produtos CTT reconhecidos; códigos desconhecidos e outras transportadoras não recebem uma identificação presumida.

A pesquisa das tabelas aceita os prefixos e os nomes dos produtos, com ou sem acentos. O detalhe acompanha os resultados filtrados, para não mostrar a tabela DD quando a pesquisa encontra apenas o EQ.

Esta alteração é de apresentação: não renomeia registos persistidos, não altera tarifas nem muda os códigos usados para emitir etiquetas. Foram verificadas a identificação do EQ existente, a distinção entre DD e DB e a pesquisa «economico» no navegador, bem como a presença do EQ no modal do cliente. TypeScript e ESLint dos novos módulos passaram; nenhum serviço ou cliente foi gravado durante a verificação.
