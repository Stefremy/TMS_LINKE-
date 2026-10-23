# Pesos e dimensões comunicados pelas transportadoras

## Interface

- OPS → Envios → clicar na guia: secção **Pesos e medidas** na barra lateral.
- **Ver Completo** → **Ficha & Moradas**: a mesma secção no modal partilhado com a Área do Cliente.
- Valores declarados apresentados separadamente dos valores devolvidos pela transportadora.
- **Consultar CTT / Correos Express** consulta o envio usando exclusivamente a referência guardada e autorizada.
- Abrir os detalhes lê apenas os dados guardados. Não faz uma chamada automática à transportadora nem bloqueia a navegação.
- As sincronizações de tracking existentes também passam a guardar os campos disponíveis. Para envios antigos, incluindo entregues, usar o botão de consulta.
- Retirado o antigo peso volumétrico fictício (peso declarado × 1,15) da barra lateral e os valores de peso predefinidos de 1 kg nestes detalhes.

## Verificação das fontes

Consultas de leitura realizadas em 23/10/2026, sem criar expedições, atualizar dados de produção ou enviar notificações.

### CTT

O WSDL atual de `EventosWS.svc?singleWsdl` define `GetEventosObjectos_V3` e os campos `_PesoReal`, `_PesoVolumetrico`, `_Comprimento`, `_Largura` e `_Altura` em `DadosEventos_V3BE`. O manual local EventosWS edição 2.0, de 2012, não documenta estes campos mais recentes.

Uma resposta de um envio entregue da Linke confirmou peso real e as três dimensões preenchidos. Os mesmos valores eram repetidos em vários eventos: a data/local de um evento não prova quando ou onde a balança fez a medição.

**Unidades pendentes de confirmação CTT:** o WSDL indica tipos (`int` e `string`), mas não unidades. A interface apresenta os valores numéricos recebidos com indicação de unidade não especificada. Não converte automaticamente gramas em kg, mm em cm ou peso volumétrico numa unidade presumida. Solicitar aos CTT as unidades de cada campo e o significado/atualização dos valores antes de ativar comparações tarifárias ou cobranças.

Eventos explicitamente inválidos (`_Valido` diferente de `1`) não fornecem medições. Valores vazios, nulos, zero, negativos ou malformados não são apresentados como medições válidas.

### Correos Express

Uma consulta de leitura ao `apiRestSeguimientoEnviosk8s/json/seguimientoEnvio`, com `gestionCompleta: "S"`, confirmou os campos de topo `kilos`, `volumen`, `alto`, `largo` e `ancho`. `kilos` é apresentado em kg; dimensões e volume conservam o valor recebido, sem presumir as unidades não documentadas.

Este retorno inclui dados de criação do envio e não distingue peso declarado de pesagem física. A interface usa **Dados comunicados pela Correos Express**, sem o classificar como peso certificado/medido. `volumen` nunca é interpretado como peso volumétrico em kg. Os manuais locais ListaEnvios, LiveTracking e geração de informes consultados não documentam uma fonte de pesagem física certificada.

## Persistência e segurança

- `audit_log`, ação `shipment_carrier_measurements`: snapshots compactos com fonte, campos numéricos, referência temporal do evento e data de obtenção. Não depende de novas colunas/tabelas.
- Snapshots não incluem contactos, credenciais, etiquetas ou resposta integral da API.
- A chave determinística evita duplicar a mesma transição em consultas simultâneas; a comparação respeita a reordenação de chaves JSONB.
- Campos ausentes numa resposta posterior não apagam valores positivos guardados anteriormente.
- API `/api/shipments/[id]/measurements`: GET lê o snapshot; POST consulta a transportadora e guarda apenas as medições.
- Ambas as operações confirmam sessão, empresa e proprietário atual do envio. O proprietário da linha nativa prevalece sobre snapshots antigos; envios só em audit usam o proprietário do snapshot mais recente.
- POST exige a mesma origem e não aceita referências de tracking fornecidas pelo cliente.
- Respostas privadas `no-store`; erros não expõem detalhes da base de dados ou da transportadora.
- Não altera preços, saldos, estados, extratos ou faturas; não envia notificações. A consulta de medições é separada da operação de sincronização de estados.
- A consulta de tracking Correos passa a ter timeout de 20 segundos; outras operações REST mantêm o comportamento existente.

## Validação

- `node --test tests/carrier-measurements.test.cjs`: 26 testes de parsing, passagem V3, persistência, deduplicação, sincronização de scans já existentes, isolamento entre lojas/empresas, referências autorizadas, origem do pedido e leitura de dimensões no JSONB de packages.
- `npm run test:security`: 158 testes passaram.
- `npm run test:tracking`: 11 testes passaram.
- Lint dos módulos novos e TypeScript verificados.
- Secção renderizada em desktop e 375 px, com dados fictícios CTT, Correos e estado vazio; sem overflow horizontal.

O snapshot comunicado pela transportadora não é uma confirmação do peso/valor efetivamente faturado. Uma futura reconciliação financeira deve usar as unidades confirmadas, o contrato aplicável e o discriminativo de faturação.
