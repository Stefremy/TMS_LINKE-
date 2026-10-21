# Navegação OPS e Área do Cliente — 21/10/2026

## Motivo da revisão

O utilizador reportou navegação lenta depois das correções de segurança. Os registos fornecidos mostravam até 5,2 s na fase do proxy, 14,6 s nas estatísticas da loja e timeouts do rastreio automático.

A F04 acrescentou autenticação e confirmação de loja ao lote. Esses controlos são necessários, mas o lote continuava a ser lançado automaticamente como Server Action ao entrar em várias páginas.

## Constatações no código

- A documentação instalada do Next.js indica execução sequencial de Server Actions por cliente e inclusão da renderização da página na resposta quando existe revalidação.
- O dashboard OPS, a lista de envios OPS e o histórico do cliente lançavam lotes de rastreio automaticamente.
- O lote revalidava páginas OPS e o layout do portal. Os componentes também pediam refresh ou estatísticas de novo.
- Uma resposta com apenas `latestStatus` era contabilizada como atualização mesmo quando nada mudava.
- Alguns intervalos eram criados dentro de callbacks assíncronos cuja limpeza nunca era executada pelo React.
- As estatísticas faziam leituras sequenciais e, para colaboradores, procuravam um perfil através da lista de todas as lojas.

Isto demonstra trabalho evitável e um caminho que pode atrasar outros pedidos da interface. Não é uma medição isolada de cada causa no navegador real nem prova de que toda a latência vinha destas alterações.

## Alterações

- O rastreio automático passa por `POST /api/tracking/sync`, através de `fetch`, separado da fila de Server Actions. A atualização manual mantém a ação existente.
- O serviço comum em `lib/services/tracking/tracking-batch.ts` preserva autenticação nas entradas, filtros de empresa/loja, confirmação individual para clientes, limite de 50 IDs e grupos de cinco.
- O endpoint exige sessão verificada, origem igual à do pedido, JSON e seleção limitada. Ignora campos de identidade submetidos no corpo. Respostas privadas sem cache.
- O endpoint de fundo não revalida layouts. A interface só pede dados novos se houver eventos, estado ou subestado diferentes.
- O hook partilhado adia a primeira consulta 1,5 s, impede sobreposição, ignora separadores ocultos e limpa temporizadores ao sair. Cancela o pedido HTTP do navegador; isso não garante o cancelamento de operações CTT já iniciadas no servidor.
- As leituras de envios, extratos e perfil nas estatísticas passam a ocorrer em paralelo. O perfil e os extratos são pedidos para a loja relevante. As fórmulas financeiras não foram alteradas.
- Não foram removidas verificações de sessão nem introduzidas caches partilhadas de permissões.

## Verificação local

| Verificação | Resultado |
| --- | --- |
| Navegação e formulários: `node --test tests/navigation-performance.test.cjs tests/shipment-submission-ui.test.cjs` | 11 passaram; 0 falhas |
| `npm run test:security` | 137 passaram; 0 falhas |
| Auditoria de isolamento completa | 68 testes: 67 passaram; apenas a F02 continua a falhar, como anteriormente |
| Casos novos de leitura paralela | Conta corrente e wallet mantêm os totais esperados da amostra fictícia; leituras usam a loja da sessão |
| ESLint dos novos módulos, endpoint, componente de polling e testes alterados | Passou |
| `npm run build` | Passou |
| Diff dos ficheiros desta revisão | Sem erros de whitespace |

Os testes usam sessões, base e transportadoras simuladas. O carregador de testes reconhece o marcador de compilação `server-only`; a compilação Next continua a validar a fronteira real. Não houve criação de envios, cobranças, emails, migrações, commit, push ou deployment nesta revisão.

## Limites e próximo controlo

- Não foi feita uma medição autenticada de navegação antes/depois no navegador do utilizador.
- A latência do proxy/autenticação e da base remota pode continuar a pesar. Os testes não certificam um tempo de resposta final.
- A F02 e as verificações RLS/permissões publicadas continuam pendentes no plano de auditoria.
- As eliminações de documentos já presentes na árvore de trabalho foram preservadas e não fazem parte desta alteração.

## Continuação — lentidão na Área do Cliente publicada

O utilizador confirmou que o problema continua na Área do Cliente em toke. Nesta ronda foram encontrados e corrigidos dois custos concretos:

- `ClientDashboard` lançava `getServicosLinkeAction()` antes da ação de estatísticas e guardava o catálogo num estado que nunca era lido. Essa chamada foi removida do dashboard; a criação de envios mantém o carregamento de serviços de que precisa.
- A validação de slug carregava `audit_log.details` completo de todas as lojas da empresa, incluindo dados que não usa, como avatares, condições comerciais e preços. Agora a projeção PostgREST devolve apenas ação, ID, nomes, slug e estado ativo. O registo nativo e o histórico de identidades são consultados em paralelo.

Mantêm-se a paginação integral de identidades, o âmbito por empresa, a validação da loja atribuída ao cliente, os slugs duplicados/reservados, as eliminações, o bloqueio de clientes inativos e a falha fechada quando a base não responde. O perfil completo continua a ser carregado apenas para a loja autorizada. Não foi acrescentada cache partilhada de contas ou permissões, nem modificada a autenticação.

### Medição de leitura real, sem alterar dados

A mesma primeira página de 10 registos de identidade foi consultada no Supabase configurado, usando o mesmo filtro e ordenação:

| Projeção | Bytes JSON | Duração observada |
| --- | --- | --- |
| Antes: `action,details` | 839 928 | 453 ms |
| Depois: apenas identidade | 1 648 | 88 ms |

Isto corresponde a cerca de 99,8% menos JSON nessa leitura. É uma comparação de duas consultas consecutivas, não um benchmark controlado nem a medição da navegação completa; aquecimento de ligações e rede podem afetar a duração. O tamanho foi medido sem imprimir perfis ou dados pessoais.

Os logins públicos publicados responderam em cerca de 0,3–0,5 s nesta amostra. Não havia uma sessão de toke acessível nos separadores automatizáveis do navegador, pelo que não se mediu o carregamento autenticado completo do painel publicado nesta ronda.

### Validação

- O novo teste de projeção falhou antes da correção por encontrar a leitura de `details` completo; depois passou.
- Testes de slugs: 18 passaram, incluindo lojas distintas, colaboradores, duplicados, inativos, eliminados, erros e paginação.
- `npm run test:security`: 138 passaram; zero falhas.
- Isolamento e regressões de navegação: 99 passaram; zero falhas.
- `npm run build`: passou, incluindo TypeScript.
- ESLint dos módulos de acesso e testes alterados e `git diff --check`: passaram.

Estas alterações são locais e precisam de publicação para afetar app.toke.pt. Não houve migrações, alterações de saldos/preços, chamadas a transportadoras, emails, commit, push ou deployment nesta ronda. F02 e P01 já foram resolvidas conforme os relatórios de auditoria; as menções a pendências nas secções anteriores descrevem a revisão anterior.
