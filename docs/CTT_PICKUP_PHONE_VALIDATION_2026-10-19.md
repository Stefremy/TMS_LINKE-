# Recolhas CTT — discrepância na validação do telemóvel

## Estado

Atualização por pedido explícito do utilizador: o TMS usa agora `255000000` como telefone do solicitante quando esse campo fica vazio. Um telefone preenchido manualmente tem prioridade. Este valor é um padrão escolhido pelo utilizador, não uma exigência do manual nem confirmação de que o número é contactável. O padrão não é aplicado ao local da recolha nem ao telemóvel. Os resultados de diagnóstico abaixo são históricos e continuam distintos de uma marcação efetivamente concluída.

Reproduzido diretamente no serviço de produção em 19/10/2026. Não está resolvido pelos ajustes de formulário ou de normalização. Requer esclarecimento dos CTT sobre o método/permissões/formato de contacto. Os testes observados não autorizam concluir uma regra universal de obrigatoriedade de telefone fixo.

Ver a leitura integral e comparação dos contratos em [Estudo do manual V1.4](CTT_RECOLHAS_MANUAL_V14_REVIEW_2026-10-19.md). O manual não exige especificamente um fixo e documenta `MarcarRecolha`, não `NewOfferPickUp`.

Atualização: foi implementada a separação entre o solicitante Linke (`ClientData`) e o local de recolha (`PickupAddress`), conforme o ecrã oficial mostrado pelo utilizador. O contacto móvel real da Linke, iniciado por 912, também foi testado: os formatos nacional, +351 e 00351 continuam a devolver a recusa em `ClientData.Phone`. A separação corrige o significado dos dados enviados, mas ainda não elimina a recusa remota.

## Método e resultados

Endpoint: `http://cttexpressows.ctt.pt/CTTEWSPool/RecolhasWS.svc`

Operação: `NewOfferPickUp`. Estrutura e ordem dos elementos conferidas com o WSDL atual (`?singleWsdl`).

Com `PickupAddress.Country = PT`:

| Campo e formato | Resposta observada |
| --- | --- |
| `ClientData.Phone`: número nacional de teste começado por 255 | Sem erro de telefone |
| `ClientData.Phone`: telemóvel nacional começado por 916 | `EW0074: ClientData: Phone Number is not valid.` |
| Mesmo telemóvel com `+351`, `351` ou `00351` | A recusa em `ClientData.Phone` mantém-se |
| `ClientData.Phone` vazio | `ClientData: Phone cannot be null or empty` |
| `PickupAddress.Phone` vazio e `PickupAddress.MobilePhone` com telemóvel nacional | Sem erro nesses campos |

Foi testado também o contacto fornecido pelo utilizador, sem o incluir neste documento: a recusa em `ClientData.Phone` foi reproduzida. O controlo com país inválido não ativa as mesmas regras e não serve para comprovar a aceitação de contactos portugueses.

Todos os pedidos de diagnóstico eram deliberadamente inválidos: data em 1900, morada vazia, dimensões zero, quantidade e peso zero. Todos devolveram falha, com múltiplos erros independentes do telefone, e nenhum número de recolha. Não foram criadas recolhas nem usados números fictícios em pedidos válidos.

O método anterior `MarcarRecolha`, ainda presente no WSDL, foi testado com dados igualmente inválidos. Devolveu `Falhou a autenticação do cliente` com as credenciais atuais; não foi adotado como alternativa.

## Contradição com a documentação

O manual `CTT API/SGEE - CTTX - WS Aplicacoes Proprias - Especificacao Tecnica V1.8.pdf`, página 55, descreve `ClientData.Phone` como obrigatório, tamanho 15, e **número de telefone/telemóvel do contacto**. A página 56 distingue `PickupAddress.Phone` de `PickupAddress.MobilePhone`.

O manual `RecolhasWS_ V1 4.pdf` descreve o método anterior; não deve ser usado para inferir sozinho as regras de `NewOfferPickUp`.

## TMS

- O formulário lê os contactos efetivamente submetidos, incluindo preenchimento automático.
- O telefone principal da loja pode ficar vazio quando existe telemóvel.
- O XML coloca o telemóvel do local em `PickupAddress.MobilePhone`; o telefone fixo do local fica vazio nesse caso.
- O contacto obrigatório do solicitante mantém o número real disponível. Não há substituição por um fixo inventado nem alteração fictícia do país.
- O solicitante é configurado no servidor por `CTT_PICKUP_REQUESTER_NAME`, `CTT_PICKUP_REQUESTER_PHONE`, `CTT_PICKUP_REQUESTER_MOBILE` e `CTT_PICKUP_REQUESTER_EMAIL`. No ambiente local foram configurados o nome e o telemóvel da Linke fornecidos pelo utilizador. A configuração fica no `.env.local` ignorado pelo Git; a produção precisa dos mesmos valores no ambiente de alojamento.
- Nome, email e contacto do solicitante não são substituídos quando se muda o local/loja da recolha. O formulário mostra os dados da Linke num bloco separado.
- A recusa dos CTT é preservada e identificada como recusa remota, sem a confundir com campos vazios no TMS.

## Texto para enviar ao suporte CTT

> Na operação NewOfferPickUp de RecolhasWS, com PickupAddress.Country=PT, um telemóvel português de 9 dígitos iniciado por 916 é rejeitado em ClientData.Phone com EW0074: ClientData: Phone Number is not valid. O mesmo contacto é aceite em PickupAddress.MobilePhone, com PickupAddress.Phone vazio. Um número iniciado por 255 não gera o erro em ClientData.Phone, enquanto o campo vazio gera Phone cannot be null or empty. As variantes +351 e 00351 não resolvem a recusa. O manual SGEE V1.8, página 55, indica que ClientData.Phone permite telefone/telemóvel. Como deve ser enviado o contacto do solicitante quando este apenas tem telemóvel? Solicitamos confirmação do formato correto ou correção da validação. Os testes foram feitos com pedidos deliberadamente inválidos e não criaram recolhas.
