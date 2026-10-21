# Auditoria ao isolamento entre clientes — primeira ronda

Data: 21/10/2026 (Europe/Lisbon)  
Referência do código analisado: `ee40497299209caeb215eb8ce9c957fd1e9a9d0c`  
Estado atualizado: F01–F04 corrigidas e validadas localmente após autorização; F02 também testada por HTTP com duas sessões reais de cliente. Permissões/RLS do Supabase publicado consultadas: P01 confirmado crítico, ainda sem alteração de grants.  
O Passo 1 ainda não está concluído: falta resolver P01, rever os restantes pontos e validar o deployment final. [Resultados da verificação real](CLIENT_ISOLATION_SUPABASE_2026-10-21.md).

## Resultado para decisão

Na ronda inicial foram reproduzidas **três falhas no código**, em **cinco testes inicialmente a falhar**. A revisão dos chamadores revelou também a F04. As atualizações abaixo preservam a evidência inicial e registam as correções F01–F04, incluindo a validação final da F02.

| ID | Prioridade | Resultado observado na simulação |
| --- | --- | --- |
| F01 | Alta | Um cliente consegue desativar a filtragem do catálogo e receber tabelas específicas de outro cliente, incluindo custos internos. |
| F02 | Alta | O ID de um envio próprio pode ser combinado com a referência de outro envio para receber a cronologia desse outro cliente. |
| F03 | Alta | Quando a consulta de autorização falha, a sincronização de rastreio pode continuar e modificar um envio de outro cliente. |

Na ronda inicial foram acrescentados apenas testes e documentação. As correções de aplicação foram autorizadas posteriormente e estão descritas nas atualizações. Não foram emitidas faturas, cobrados pagamentos, enviados emails, criados envios/recolhas reais ou alterados dados comerciais. No teste real posterior foi criado e apagado um login temporário autorizado.

## O que foi efetivamente testado

Os módulos TypeScript reais são executados pelo carregador de testes existente, com sessões fictícias, uma base de dados em memória e transportadoras/Stripe simulados. As funções de consulta e gravação de rastreio são reais; os resultados externos são fictícios.

- Cliente A e Cliente B pertencem à mesma empresa, mas a lojas diferentes.
- A listagem de envios ignora um ID de loja B submetido por A.
- Etiquetas de A são devolvidas; as de B são recusadas, por UUID e por referência da transportadora.
- A listagem paginada não devolve os envios de B nos casos testados.
- A listagem de extratos limita o cliente à própria loja e exclui documentos da empresa estrangeira da amostra.
- As estatísticas do portal e o saldo utilizado mantêm o âmbito de A quando são submetidos identificadores de B.
- O carregamento Stripe de B por A é recusado antes de criar uma transação ou pedir um checkout.
- Um carregamento próprio continua a funcionar com checkout fictício.
- O rastreio direto de B é recusado; o rastreio próprio continua a funcionar.
- O fecho de manifesto recusa seleções de outra loja, outra empresa e seleções misturadas.
- A bateria existente cobre também slugs de loja, moradas, páginas do portal, criação de envios e os cinco tipos de download financeiro.

### Resultados dos comandos

| Verificação | Resultado |
| --- | --- |
| `npm run test:security` | 137 testes passaram; 0 falhas. |
| `node --test --test-name-pattern='client scope\|foreign selections' tests/ctt-manifest.test.cjs` | 2 testes passaram; 0 falhas. |
| `node --test tests/client-isolation-audit.test.cjs` | 19 testes: 14 passaram e 5 reproduziram as falhas F01–F03. Código de saída 1 esperado. |
| ESLint dos dois novos ficheiros de teste | Passou. |

Os testes novos exprimem o comportamento seguro esperado. Não foram desativados, marcados como `todo` nem alterados para aceitar as vulnerabilidades. O comando de auditoria continua separado do script `test:security`; a sua inclusão na validação automática fica para o passo de regressão.

## F01 — Parâmetro do cliente desativa o isolamento do catálogo

Código: [app/actions/servicos-linke.ts](../app/actions/servicos-linke.ts), linhas 515–517, 552 e 610.  
Testes: [tests/client-isolation-audit.test.cjs](../tests/client-isolation-audit.test.cjs), casos F01.

A função exportada `getServicosLinkeAction(skipRedaction)` calcula a restrição de cliente a partir de `ctx.role === "client" && !skipRedaction`. Ao submeter `true`, o cliente deixa de ser tratado como cliente para efeitos da filtragem.

**Reprodução local:** a sessão de A pede `getServicosLinkeAction(true)`. O resultado contém `service-b`, uma tabela específica de B, com `cost_price` e dados internos de configuração. O mesmo comportamento ocorre ao ler a tabela principal e no fallback de `audit_log`.

**Proposta inicial (F01 corrigida na atualização abaixo):** obter sempre o âmbito e a redação a partir da sessão verificada no servidor. Um argumento submetido pelo cliente nunca deve desativar a filtragem por loja. Rever também o filtro por empresa nas consultas do catálogo. Manter as fórmulas e valores de preços.

Critério de aceitação: ambos os testes F01 passam, os clientes continuam a receber apenas o catálogo permitido e os colaboradores mantêm os acessos autorizados.

## F02 — Referência de rastreio não vinculada ao envio autorizado

Código: [app/actions/shipments.ts](../app/actions/shipments.ts), funções `getShipmentTrackingTimelineAction` e `loadShipmentTrackingTimeline`.  
Testes: casos F02 no ficheiro de auditoria. Corrigida na atualização final abaixo.

Antes da correção, `getShipmentTrackingTimelineAction` confirmava que o ID inicial pertencia a A, mas passava a referência de rastreio recebida para a função de leitura. Se o envio inicial não tivesse eventos, o fallback procurava outro envio pela referência e lia os seus eventos sem voltar a confirmar a loja.

**Reprodução local:** A tem um envio sem eventos. B tem um envio com o evento fictício `PRIVATE-B-EVENT`. A chama a ação com o seu ID e a referência de B; recebe o evento de B.

**Correção autorizada e aplicada localmente:** resolver a referência canónica a partir do envio autorizado e manter o âmbito de empresa e cliente nos fallbacks privados. Recusar combinações inconsistentes de ID e referência. Ver testes e limites na atualização final.

Há um rastreio público intencional no produto. Esse comportamento precisa de uma política de dados própria; não elimina a necessidade de vincular os identificadores nas ações autenticadas. Esta falha não reproduziu acesso a etiquetas ou documentos financeiros.

## F03 — Falha na consulta de autorização permite continuar a sincronização

Código: [lib/services/tracking/tracking-dispatcher.ts](../lib/services/tracking/tracking-dispatcher.ts), linhas 29–66; [lib/services/tracking/tracking-recorder.ts](../lib/services/tracking/tracking-recorder.ts), linhas 35–48.  
Entrada testada: `syncShipmentTrackingAction`, em [app/actions/shipments.ts](../app/actions/shipments.ts), linha 1059.

O dispatcher usa o resultado `data` da procura, sem tratar o erro. A recusa de acesso exige que exista um `targetShipment`. Se a leitura falhar e devolver `null`, a ação conserva o ID recebido e continua até à gravação.

**Pré-condição importante:** a leitura inicial de autorização falha, mas operações posteriores conseguem ser executadas. O cliente não controla necessariamente essa falha; o teste injeta-a para verificar a segurança do percurso de erro.

**Reprodução local:** A submete o ID de B. A leitura inicial devolve um erro simulado. A transportadora fictícia devolve um evento de entrega. Tanto no cenário CTT como no cenário Correos, houve uma chamada ao simulador, duas operações de escrita e o estado do envio de B passou de `pendente` para `entregue` na base em memória.

**Proposta inicial (F03 corrigida na atualização abaixo):** em pedidos de clientes, qualquer erro ou ausência de prova de pertença deve interromper a operação antes de consultar a transportadora ou gravar dados. Resolver o envio com os filtros de empresa e cliente e usar o registo verificado nas gravações.

Os testes usam o dispatcher e o gravador reais, mas nenhum pedido foi enviado aos CTT/Correos e nenhum envio real foi alterado.

## F04 — Atualização em lote sem sessão e sem isolamento da loja

Prioridade: **Alta**. Reprodução local descoberta durante a revisão dos chamadores da F03. Correção posteriormente autorizada e aplicada; ver a atualização F04 abaixo.

Código: `syncActiveShipmentsBatchAction`, em [app/actions/shipments.ts](../app/actions/shipments.ts). A ação exportada pesquisa IDs recebidos através do cliente administrativo sem chamar `requireUser`, não filtra empresa/loja e invoca o dispatcher com `skipAuth: true`, sem contexto de utilizador. É um percurso diferente da sincronização individual corrigida na F03.

**Reprodução local:** foram executados dois casos usando a função real, base em memória e transportadora simulada:
- Sem sessão, um pedido em lote para B realizou 5 consultas, 1 chamada ao simulador e 2 escritas.
- Com sessão de A, um pedido em lote para B realizou 1 chamada ao simulador e 2 escritas; B passou de `pendente` para `entregue`.

Os dois testes F04 falhavam antes da correção, preservando a evidência da reprodução. Não houve tráfego para transportadoras, emails ou alterações em produção. Não foram feitos pedidos HTTP sem sessão ao site publicado.

**Proposta inicial (F04 corrigida na atualização abaixo):** exigir sessão no servidor antes de aceder à base, limitar a consulta à empresa e, para clientes, à própria loja. Usar contexto verificado ao invocar o dispatcher; a otimização com um objeto já carregado deve ficar restrita a percursos internos autorizados. Testar também o lote normal de clientes e colaboradores, seleções mistas, ausência de sessão e erros de consulta.

## Permissões e revisões complementares

### P01 — Permissões da função de incremento de saldo — crítico confirmado

A migração [20261007000000_add_increment_balance.sql](../supabase/migrations/20261007000000_add_increment_balance.sql) define `increment_client_balance(uuid,numeric)` com `SECURITY DEFINER`, sem validação do solicitante, da loja ou da empresa no corpo. Não foi encontrada outra migração no repositório a restringir `EXECUTE` dessa função.

**Atualização publicada confirmada em 21/10/2026:** a função mantém esse corpo sem autorização e permite efetivamente execução a `PUBLIC`, `anon` e `authenticated`. O risco crítico foi confirmado por ACL e definição publicada; não foi executado um incremento de saldo para demonstrar exploração.

As consultas de metadados foram executadas numa forma consolidada equivalente ao [SQL de referência](../supabase/audits/20261021_client_isolation_readonly.sql). Foi preparada uma [proposta de restrição ainda não aplicada](../supabase/audits/proposals/20261021_restrict_increment_balance.sql). [Resultados e limites](CLIENT_ISOLATION_SUPABASE_2026-10-21.md).

### P02 — Filtros de empresa inconsistentes em percursos antigos

A leitura de etiquetas e a listagem paginada verificam a loja do cliente, mas não aplicam explicitamente `tenant_id` em todas as consultas. Foram registadas como lacunas de defesa; os testes A/B desta ronda não demonstraram uma fuga através delas. É necessário verificar a coerência das referências e das políticas na base real.

### P03 — Dados intencionalmente públicos e dados internos

O rastreio público aceita referências exatas e devolve nomes, localidades e cronologia. Não devolve diretamente etiquetas, faturas ou saldos nesse objeto. É necessário decidir e validar quais destes campos podem ser públicos e como se limita a pesquisa de referências.

As listagens de envios usam projeções amplas e podem incluir custos internos do próprio envio. A decisão de apresentação desses campos deve ser revista, distinguindo-a de acesso a dados de outra loja.

## Limites desta ronda

Os limites seguintes descrevem a ronda inicial. A validação posterior da F02 e a inspeção publicada estão documentadas na atualização final e no relatório de Supabase.

- Não houve acesso a contas ou dados de produção, nem testes HTTP com sessões reais de A/B.
- A base em memória não executa RLS, funções PostgreSQL, grants ou constraints SQL. Os testes não certificam essas camadas.
- Não foi demonstrado que o deployment publicado está no mesmo commit.
- Não foi concluída a auditoria de impersonação, revogação de colaboradores, integridade financeira, ficheiros públicos ou desempenho; são os passos seguintes do plano.
- Não foi repetido build/lint global: esta ronda não alterou o código da aplicação. O lint executado foi o dos testes novos.
- Não há fundamento para declarar o sistema pronto para entrega enquanto as falhas confirmadas e as validações pendentes não estiverem resolvidas.

## Atualização — F01 corrigida localmente em 21/10/2026

Autorização: o utilizador aprovou avançar com a correção isolada da F01. As secções anteriores preservam a evidência e os resultados da ronda inicial.

- Foi removido o parâmetro `skipRedaction` da ação exportada. A filtragem por loja e a ocultação de custos internos dependem exclusivamente da função da sessão verificada no servidor.
- Um argumento extra enviado por um cliente, incluindo `true` ou um objeto, já não desativa a proteção.
- Os testes cobrem A e B, tabelas gerais, leitura principal e fallback, custos e configurações internas, preços de venda, colaboradores, administradores e pedidos sem sessão.
- A alteração de aplicação limita-se à assinatura e à decisão de autorização da ação. Não foram modificadas fórmulas, valores de preços, migrações ou integrações.
- Os filtros por empresa do catálogo continuam como ponto de revisão. Esta correção resolve o bypass confirmado por parâmetro; não certifica isolamento entre empresas nem permissões/RLS na base publicada.

### Validação da correção

| Verificação | Resultado |
| --- | --- |
| Casos F01 ampliados antes da correção | 11 testes: 5 passaram e 6 falharam, confirmando a vulnerabilidade. |
| `node --test --test-name-pattern='F01\|normal catalog' tests/client-isolation-audit.test.cjs` | 13 passaram; 0 falhas. |
| `npm run test:security` | 137 passaram; 0 falhas. |
| Auditoria completa de isolamento | 28 testes: 25 passaram; continuam 3 falhas, exclusivamente F02 e F03 (CTT e Correos). |
| ESLint dos dois ficheiros de teste da auditoria | Passou. |
| `npm run build` | Passou, incluindo compilação e TypeScript. |
| `git diff --check` | Passou. |

Os testes usaram dados fictícios e integrações simuladas. Não foram feitos testes HTTP com sessões reais nem aplicada qualquer migração. Não houve commit, push ou deployment desta correção.

## Atualização — F03 corrigida localmente em 21/10/2026

Autorização: o utilizador pediu para continuar com o próximo passo proposto, a correção isolada da F03.

- As duas entradas individuais (`syncShipmentTrackingAction` e `syncCttTrackingAction`) passam a empresa da sessão verificada ao dispatcher.
- Para clientes, todas as consultas de autorização filtram empresa e loja. Um erro devolvido pela base, uma exceção, ausência de registo ou contexto incompleto interrompem a operação antes de consultar a transportadora ou escrever.
- Um objeto de envio fornecido previamente não substitui a confirmação de propriedade para clientes. `skipAuth` também não desativa a proteção quando o contexto identifica um cliente.
- A referência e a escolha da transportadora para clientes vêm do envio verificado, impedindo o uso de uma referência submetida de outro envio.
- As gravações usam o ID do registo verificado. O gravador e os serviços CTT/Correos não foram modificados. Os percursos internos autorizados mantêm suporte a objetos de envio previamente carregados.
- A correção F03 abrange a sincronização individual; o percurso em lote sem contexto foi registado separadamente como F04 e ficou pendente nessa ronda. Foi corrigido na atualização seguinte.

### Validação da F03

| Verificação | Resultado |
| --- | --- |
| Casos F03 ampliados antes da correção | 25 testes: 7 passaram e 18 falharam. |
| Casos F03 finais | 27 passaram; 0 falhas, incluindo referências contraditórias e envio sem referência guardada. |
| `npm run test:security` | 137 passaram; 0 falhas. |
| Auditoria completa de isolamento | 55 testes: 52 passaram; 3 falharam, exclusivamente F02 e os dois casos da nova F04. |
| ESLint dos dois ficheiros de teste da auditoria | Passou. |
| ESLint do dispatcher comparado com `HEAD` | Mesmo resultado anterior: 3 erros por `any` e 1 aviso por variável não usada. Nenhum diagnóstico adicional. Não representa lint global limpo. |
| `npm run build` | Passou, incluindo compilação, TypeScript e geração das páginas. |
| `git diff --check` | Passou. |

Os testes usaram sessões e dados fictícios, base em memória e integrações simuladas. Continuam por executar os testes HTTP com contas reais e a validação de permissões/RLS. Não houve alteração de preços, migração, commit, push ou deployment.

## Atualização — F04 corrigida localmente em 21/10/2026

Autorização: após a explicação com exemplos, o utilizador pediu para avançar com a F04.

- `syncActiveShipmentsBatchAction` exige sessão antes de tratar os identificadores ou consultar envios, incluindo pedidos vazios ou malformados.
- A consulta limita os envios à empresa da sessão. Nos pedidos de clientes, aplica também a loja atribuída no servidor; IDs de outra loja ou empresa não entram no lote.
- Cada sincronização recebe o contexto verificado. O dispatcher volta a confirmar a propriedade nos pedidos de clientes e não usa o objeto previamente carregado para contornar essa confirmação.
- Colaboradores e administradores continuam a atualizar várias lojas da própria empresa, mesmo quando estão a visualizar uma loja específica.
- Erros devolvidos pela base e exceções na consulta inicial terminam o lote com zero atualizações e uma mensagem genérica. Uma falha na confirmação individual impede a consulta à transportadora e a gravação desse envio.
- Foram preservados a exclusão de envios terminados, a eliminação de IDs duplicados, o limite de 50 IDs e os grupos de cinco pedidos. As fórmulas de preço, os serviços das transportadoras, o gravador e as migrações não foram alterados.

### Validação da F04

| Verificação | Resultado |
| --- | --- |
| Casos F04 ampliados antes da correção | 13 testes: 1 passou e 12 falharam. |
| `node --test --test-name-pattern=F04 tests/client-isolation-audit.test.cjs` | 13 passaram; 0 falhas. |
| `npm run test:security` | 137 passaram; 0 falhas. |
| Auditoria completa de isolamento | 66 testes: 65 passaram; a única falha restante é F02. F01, F03 e F04 passam. |
| ESLint dos dois ficheiros de teste da auditoria | Passou. |
| ESLint de `app/actions/shipments.ts` comparado com `HEAD` | Mesmo resultado anterior: 36 erros e 6 avisos. Nenhum diagnóstico adicional; o ficheiro ainda tem problemas de lint preexistentes. |
| `npm run build` | Passou, incluindo compilação e TypeScript. |
| `git diff --check` | Passou. |

Os testes cobrem lotes mistos nos dois sentidos A/B, outra empresa, acesso de colaboradores e administradores, CTT/Correos simulados, ausência de sessão, contexto incompleto, pedidos vazios/malformados, envios terminados, erros de consulta e alteração da propriedade antes da confirmação individual.

Não houve chamadas reais às transportadoras, cobranças, emails ou alterações em produção durante os testes. Não houve migração, commit, push ou deployment. O teste F02 continua ativo e a falhar; não foi desativado nem adaptado para aceitar o problema. O Passo 1 ainda não está concluído.

## Atualização — F02 corrigida e verificada com sessões reais em 21/10/2026

Autorização: corrigir F02, confirmar permissões do Supabase e testar com dois logins controlados. A criação/eliminação do login temporário da GO Linke também foi expressamente autorizada.

- A ação autenticada exige sessão, função reconhecida, empresa e, para clientes, loja válida antes de consultar dados. Confirma o envio na empresa e verifica o proprietário do registo atual; um snapshot antigo não pode substituir essa propriedade.
- Para envios antigos sem linha nativa, verifica o snapshot mais recente da mesma empresa e ID e só depois o proprietário. Um erro de autorização não é tratado como ausência de registo para ativar um fallback.
- ID e referência contraditórios são recusados antes de consultar eventos. Os fallbacks usam uma referência guardada, limitam envios relacionados à mesma empresa/loja e filtram eventos e audit log pela empresa.
- O registo já autorizado é reutilizado na leitura para evitar outra consulta de metadados. A consulta nativa respeita o esquema efetivamente publicado, que não tem a coluna opcional `ctt_object_id`; essa referência continua suportada nos snapshots antigos.
- Colaboradores mantêm acesso às lojas da própria empresa. O rastreio público por referência exata mantém o percurso separado e o teste de regressão; a política de campos públicos P03 continua por rever.
- Não foram modificados preços, gravadores de rastreio ou integrações com transportadoras. A proposta de grants P01 foi guardada fora de `migrations` e não foi aplicada.

### Validação final

| Verificação | Resultado |
| --- | --- |
| Primeiros casos F02 ampliados antes da correção | 20 casos: 6 passaram e 14 falharam. |
| Casos F02 finais | 26 passaram, incluindo a reprodução original com histórico próprio vazio. |
| `node --test tests/client-isolation-audit.test.cjs` | 93 passaram; 0 falhas. |
| Isolamento, navegação, submissão e mapas antes do último caso adicional | 114 passaram; 0 falhas. O caso adicional passou na execução final de isolamento acima. |
| `npm run test:security` | 137 passaram; 0 falhas. |
| `npm run build` | Passou, incluindo TypeScript. Foi este build que recebeu os pedidos HTTP reais. |
| ESLint do teste de isolamento | Passou. |
| ESLint de `app/actions/shipments.ts` comparado com `HEAD` | 33 erros e 6 avisos em ambos, com a mesma distribuição de regras; não representa lint global limpo. |
| Duas sessões reais, HTTP local | Históricos próprios com 5 e 12 eventos; quatro tentativas cruzadas recusadas; sem sessão, redirecionamento para login. |
| Supabase publicado | Inspeção de RLS/grants concluída para os objetos listados; P01 confirmado crítico e ainda por corrigir. |

Os [resultados detalhados e limites dos testes reais](CLIENT_ISOLATION_SUPABASE_2026-10-21.md) ficam registados separadamente. Não houve commit, push, deployment ou alteração de permissões nesta ronda.

## Continuação proposta

1. Rever e autorizar a proposta **P01**: restringir a função de saldo a `service_role`, preservando o chamador administrativo Stripe.
2. Rever os filtros por empresa do catálogo e os restantes pontos P02/P03.
3. Validar o deployment final e os restantes percursos do Passo 1 antes de concluir a auditoria e entregar a clientes.

Comando de reprodução de todos os resultados novos:

```sh
node --test tests/client-isolation-audit.test.cjs
```

Para executar apenas as reproduções das falhas:

```sh
node --test --test-name-pattern='F01|F02|F03|F04' tests/client-isolation-audit.test.cjs
```
