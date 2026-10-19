# Consulta e gestão de recolhas

A página `/ops/envios/recolhas` inclui lista recente, pesquisa e criação de pedidos. A referência e o botão **Ver detalhes** abrem a ficha da recolha.

## Pesquisa e detalhes no TMS

- A pesquisa usa a data prevista de recolha, com intervalo inclusivo, referência parcial e estado guardado.
- O histórico tem paginação de 50 resultados e fica limitado à empresa do operador autenticado. Contas de cliente não podem executar estas consultas.
- A ficha apresenta os dados históricos disponíveis: local, contactos, solicitante, pesos, volumes, dimensões e observações. Os novos pedidos passam a guardar estes campos no registo de metadados existente.
- Os pedidos antigos podem ter informação incompleta. Não são preenchidos com os dados atuais da loja, pois esses dados podem ter mudado desde o pedido.
- O estado local não é apresentado como confirmação de alterações posteriores no portal CTT.

## Consulta direta aos CTT

Foram implementadas as operações de leitura `PesquisaRecolhas` e `GetRecolha`, com parâmetros e estruturas conferidos no WSDL de produção em 19/10/2026. A pesquisa remota requer referência completa ou intervalo até 60 dias. Com referência completa, não envia datas.

A verificação real, exclusivamente de leitura, devolveu: **Utilizador não tem permissões para utilizar o serviço**. A conta precisa de autorização CTT para estas operações antigas; o sucesso de `NewOfferPickUp` não garante autorização para consultar a API antiga. O erro é mostrado na interface e não impede a consulta dos registos TMS.

## Alteração e anulação

O WSDL publicado não contém operações de alteração ou anulação. O separador **Alterar / Anular** permite copiar a referência e abrir o Portal Expresso para alterar data, morada, período ou anular. A operação tem de ser confirmada no portal. Estes atalhos não atualizam o estado local nem simulam uma confirmação CTT.

## Confirmação manual de recolha

Nos detalhes de um registo TMS agendado ou pendente, **Marcar como recolhida** abre uma confirmação. **Sim, confirmar recolha** passa o estado para `Realizado`, atualiza a lista e guarda no `audit_log` uma entrada `recolha_manual_confirmation`, com operador autenticado, hora do servidor e estado anterior. A ficha mostra essa identificação após voltar a abrir.

A ação exige um operador autenticado e limita a atualização à sua empresa. Recusa recolhas canceladas, não sobrescreve alterações concorrentes de estado e não duplica a confirmação de um registo já realizado. Não altera envios nem comunica uma recolha aos CTT. Se a gravação da auditoria falhar, tenta repor o estado anterior e comunica a falha sem apresentar sucesso. Estado e auditoria usam dois pedidos à base de dados, não uma transação única.

## Encomendas associadas

A ficha tem uma secção **Encomendas associadas à recolha**, com códigos e hora da última consulta. **Atualizar objetos e detalhes nos CTT** consulta `GetRecolha` e lê `_Objectos.string`. Nos registos TMS, uma resposta válida fica guardada no `audit_log` como `recolha_ctt_objects`, limitada à empresa, ID local e referência CTT. A referência da resposta tem de coincidir com o pedido. A última lista é recuperada ao voltar a abrir a ficha e preservada se uma nova consulta falhar.

Não existe atualização por scan ou sincronização periódica nesta implementação. O operador pede a atualização na ficha. É necessário que os CTT autorizem a consulta e disponibilizem as associações. Uma lista vazia significa apenas que a consulta não devolveu códigos, não prova que a recolha esteja vazia. A confirmação manual não cria associações e o rastreio de uma encomenda, isoladamente, não permite deduzir a que recolha pertence.

## Verificação

- `node --test tests/pickup-management.test.cjs tests/ctt-pickup-serialization.test.cjs`: 21 testes aprovados, incluindo confirmação manual, isolamento, repetição, concorrência, reposição após falha de auditoria, objetos associados e preservação de consultas anteriores.
- `npm run test:security`: 137 testes aprovados.
- ESLint nos novos módulos: aprovado.
- Interface verificada num navegador com respostas simuladas: pesquisa, abertura da ficha, quatro atalhos para o portal, fecho por botão e Escape, e largura em telemóvel de 390 px. Capturas em `/tmp/tms-pickup-details-desktop.png` e `/tmp/tms-pickup-details-mobile.png`.
- TypeScript global continua com erros anteriores em `LocalWeather.tsx` e no campo `destination` do pedido Correos em `app/actions/ctt.ts`; não foram introduzidos diagnósticos nos novos módulos.
- Nenhuma recolha real foi criada, alterada ou anulada durante esta verificação.
