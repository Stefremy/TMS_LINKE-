# Tabela Ponto CTT / Cacifo Locky retirada temporariamente

A pedido do utilizador, a tabela «Linke Ponto CTT / Cacifo Locky» (`srv_linke_ponto_ctt` / `LK-PONTO`) foi retirada do catálogo enquanto a integração de entrega em ponto/cacifo está incompleta.

A regra comum em `lib/services/service-availability.ts` exclui esta tabela tanto dos registos persistidos como do catálogo legado de valores padrão. Os ecrãs de serviços, simulação, atribuição ao cliente e seleção para novos envios usam esse catálogo. Os contadores do modal do cliente contabilizam as tabelas ainda visíveis.

O contexto de preços também exclui a tabela, impedindo a emissão de etiquetas e a criação de rascunhos a partir de pedidos antigos ou com identificadores enviados manualmente, para clientes e equipa de Ops. O produto Para Amanhã normal permanece disponível: não se bloqueia `EMSF056.01`, que é partilhado com a tabela retirada.

Não foi apagado nem alterado o registo real da tabela, nem os envios históricos ou as atribuições persistidas dos clientes. Para voltar a disponibilizar a tabela, a regra temporária deve ser retirada quando a escolha do ponto/cacifo, o envio dos dados aos CTT e a zona de preços estiverem implementados e verificados.

Verificação: os 130 testes de segurança passaram. Testes isolados cobrem o catálogo direto e legado, nomes/códigos alterados e pedidos antigos de clientes, colaboradores e administradores; nenhuma transportadora ou gravação real é utilizada. TypeScript e o lint dos novos módulos e testes passaram. O catálogo local mostra 16 tabelas, sem esta opção; a pesquisa «Locky» não devolve resultados.
