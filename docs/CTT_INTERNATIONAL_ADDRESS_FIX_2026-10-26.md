# Moradas e contactos internacionais CTT — 26/10/2026

Um envio para Espanha / 28013 devolveu «O codigo postal é inválido:
2801-003» e erro de telefone do destinatário. Foram reproduzidas duas
falhas independentes em testes sem rede:

- A ação de emissão usada pelo OPS e portal forçava `recipient.country`
  para `PT`, apesar do país usado no cálculo de preço ser `ES`.
- O adaptador CTT dividia todos os códigos postais nos campos portugueses
  `PTZipCode4` e `PTZipCode3`. Para 28013, os CTT recebiam 2801 e 3.

A serialização dos contactos também retirava apenas o indicativo +351 e
identificava apenas telemóveis portugueses. Um +34 612… não era tratado
como um telemóvel espanhol.

Correções locais:

- A emissão mantém o país selecionado e guarda país/localidade no snapshot
  completo do envio. A inserção na tabela nativa mantém as colunas existentes.
- Moradas não portuguesas usam `NonPTZipCode` e
  `NonPTZipCodeLocation`, sem preencher os campos postais portugueses.
  Preservam letras e zeros iniciais, incluindo 07001.
- Códigos espanhóis fora do formato de cinco dígitos são rejeitados antes
  da reserva de saldo ou de contactar a transportadora.
- O indicativo explícito do contacto tem prioridade sobre o país da morada.
  Por exemplo, uma entrega espanhola pode ter um telemóvel português,
  francês ou britânico. Os contactos estrangeiros conservam o indicativo;
  o prefixo 00 é normalizado para +. Telemóveis PT, ES, FR e GB são
  classificados pelo plano do número. Indicativos não reconhecidos são
  preservados como telefone, sem rejeição ou conversão para outro país.
  A omissão do indicativo usa o país da morada apenas para classificar o
  número local; contactos estrangeiros devem indicar o seu prefixo.
  A normalização nacional dos contactos PT/ES no próprio país foi mantida.
  Campos vazios do destinatário não recebem um número inventado.
- O emissor direto CTT também aceita o país explicitamente, mantendo PT
  como valor predefinido quando não foi indicado.

Referência local: `CTT API/SGEE - CTTX - WS Aplicacoes Proprias - Especificacao
Tecnica V1.8.pdf`, páginas 12–13, 21 e 38: campos internacionais, contactos
opcionais e ordenação XML da classe AddressData.

Validação: 88 testes passaram, cobrindo emissão autorizada cliente/OPS,
serialização real de CreateShipment/CompleteShipment com transporte SOAP
simulado, contactos PT/ES, códigos internacionais, fecho de manifesto,
recolhas e regressões de segurança/faturação da emissão. TypeScript passou;
os ficheiros de integração mantêm os problemas de lint anteriores, sem
introduzir novos.

Após o esclarecimento sobre contactos de países diferentes da morada,
passaram 30 testes de contactos e protocolo, incluindo entrega em ES com
+351, +33, +44, prefixos 00, telefones fixos, canais explícitos distintos e
indicativos desconhecidos. As referências de classificação FR/GB são os
planos da [Arcep](https://www.arcep.fr/la-regulation/grands-dossiers-thematiques-transverses/la-numerotation.html)
e da [Ofcom](https://www.ofcom.org.uk/phones-and-broadband/phone-numbers/numbering-data).

Não foram feitas emissões reais, chamadas de criação aos CTT, alterações
de preços ou saldos, commits ou deployment. A aceitação final pelo
transportador ainda precisa de ser confirmada no pedido real do utilizador.

## Dados do conteúdo e exportação

Depois de corrigir a morada, o utilizador recebeu dos CTT «O tipo de
exportação é obrigatório» e «O tipo de produto é obrigatório». A integração
não incluía `ShipmentData.ExportType` nem `ShipmentData.UPUCode`.

Foram acrescentados aos formulários OPS e cliente três campos obrigatórios
apenas para envios internacionais CTT: tipo de exportação, tipo de conteúdo
e valor declarado do conteúdo. Não há seleção nem valor assumidos. O portal
limpa estes campos após uma criação bem-sucedida; no OPS seguem o reset do
formulário. O valor do conteúdo é independente da tarifa de transporte e
do valor à cobrança.

A validação no servidor rejeita dados em falta, enums inválidos, valores
negativos ou não finitos antes de reservar saldo ou pedir uma etiqueta.
O adaptador também valida antes de qualquer chamada SOAP. O valor zero
é serializado explicitamente quando o utilizador o indica. A declaração
validada fica no snapshot `shipment_data` em `ctt_export_details`, sem
introduzir colunas na tabela nativa.

Referência: especificação local SGEE V1.8, páginas 13/22 (obrigatoriedade),
25 e 44–45 (nomes dos enums) e 39 (ordem do XSD). O XML usa os nomes
`Permanent`, `TemporaryPassiveImprovement`, `TemporaryExhibition` e os
valores UPU `Goods`, `Documents`, `Samples`, `Devolution`, `Others`.
`ExportType` segue `DeclaredValue`; `UPUCode` segue `Quantity`.

Uma recusa confirmada dos CTT passa também a ser mostrada como validação,
sem o prefixo enganador «Erro de ligação». Não foram acrescentados campos
obrigatórios a envios nacionais ou à integração Correos.

Validação final desta correção: 37 testes de moradas/contactos/exportação,
66 testes de segurança/emissão, TypeScript e build passaram. Foram ainda
verificados a obrigatoriedade dos campos e o layout em 1280, 768, 390 e
320 px, com dados fictícios. Não houve emissão real. As exigências
alfandegárias adicionais de destinos extracomunitários não foram
implementadas nesta correção do envio para Espanha.
