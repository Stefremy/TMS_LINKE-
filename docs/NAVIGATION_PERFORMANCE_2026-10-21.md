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
