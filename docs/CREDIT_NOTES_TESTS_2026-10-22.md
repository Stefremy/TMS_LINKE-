# Notas de crédito — testes e correções de 22/10/2026

## Âmbito

Verificação local da emissão e consulta de notas de crédito, associação à fatura original, permissões, isolamento por empresa/cliente, PDFs, valores por liquidar e recuperação de falhas.

Base do repositório: `d890308`, com as correções locais da revisão anterior. Foram acrescentados **15 testes**, passando a bateria específica de 21 para **36 casos**. Moloni, Supabase e falhas de rede foram simulados nos testes. Não foram emitidos documentos fiscais reais, enviados emails, alterados saldos ou executadas migrações nesta ronda.

## Resultados finais

| Verificação | Resultado |
| --- | --- |
| `npm run test:credit-notes` | 36/36 passaram |
| `npm run test:billing` | 61/61 passaram |
| `npm run test:security` | 154/154 passaram |
| `npm run test:recurring` | 34/34 passaram |
| Total das quatro baterias | **285/285 passaram** |
| `npm run build` | Passou, incluindo compilação e TypeScript |
| ESLint dos módulos de notas de crédito | Sem erros ou avisos |
| `git diff --check` | Passou |
| Lint global | Reprovado: 816 erros e 431 avisos anteriores, fora dos módulos de notas de crédito |

O lint global analisou 532 ficheiros. A maioria dos erros é `@typescript-eslint/no-explicit-any` (684). Os ficheiros da funcionalidade de notas de crédito não apresentaram problemas. O teste de faturação já tinha um aviso de expressão não utilizada, fora das linhas alteradas nesta ronda. O build passar não significa que o lint global esteja resolvido.

## Problemas reproduzidos e corrigidos

### Pesquisa vazia durante a criação

Foi suspenso artificialmente um pedido de criação antes de o documento aparecer na pesquisa do Moloni. Consultar ou cancelar nessa altura podia marcar a tentativa como cancelada e libertar o bloqueio, permitindo outra criação enquanto a primeira ainda decorria.

Agora uma pesquisa vazia mantém a operação protegida. A interface pede nova consulta e não presume cancelamento. O teste confirma que outro pedido continua bloqueado e que só existe uma criação quando o primeiro termina.

### Cancelamento a disputar a emissão

Com o fecho fiscal suspenso, outro pedido de cancelamento conseguia eliminar o rascunho e substituir o estado da operação. Foi também reproduzido o cancelamento após um timeout de fecho, quando uma leitura ainda mostrava rascunho.

O servidor recusa o cancelamento enquanto a criação, emissão ou cancelamento anterior estiver em curso/por confirmar. Só permite eliminar um rascunho identificado numa fase em que essa eliminação é segura. A interface acompanha esta restrição. Uma resposta perdida ao eliminar um rascunho mantém a tentativa por confirmar, sem reenviar automaticamente a eliminação.

### Fatura liquidada depois de preparar o rascunho

Depois de preparar uma nota, foi simulado um recibo no TMS ou uma liquidação no Moloni. A confirmação não voltava a validar a fatura original. Foi ainda reproduzido um pagamento parcial que deixava um valor em aberto inferior ao da nota.

A confirmação volta agora a ler a fatura, verificar o estado e a associação à empresa, documento e cliente Moloni. Recusa o fecho quando a fatura ficou liquidada ou o valor por liquidar é insuficiente.

### Erro ao consultar operações existentes

Uma falha de leitura da base de dados era ignorada na procura de uma nota em curso, podendo mostrar uma preparação nova como se não existissem operações anteriores.

O erro é agora comunicado e a preparação fica interrompida. O bloqueio contra duplicações continua ativo.

## Outros casos confirmados

- Resposta de fecho Moloni `{valid: 1}`, seguida de leitura do documento: não depende da presença de `document_id` nessa resposta.
- Duas confirmações simultâneas, repetição do mesmo pedido e outro pedido contra a mesma fatura: apenas um fecho/criação autorizado.
- Perda da resposta de criação ou de fecho e falha ao guardar o resultado depois do fecho: recuperação por consulta, sem segunda emissão.
- Quantidades já creditadas, seleção duplicada, artigos desconhecidos e valores inválidos: recusados antes de criar um documento.
- Preservação dos IDs de artigos e impostos originais, descontos, isenções, taxas de IVA diferentes e quantidades fracionárias.
- Faturas personalizadas e extratos de transporte: associação ao documento original e preservação do seu valor histórico.
- Clientes, anónimos e colaboradores sem permissão financeira: ações de gestão recusadas antes do acesso administrativo à base.
- Colaborador financeiro de outra empresa: não pode consultar, confirmar ou cancelar a nota.
- Portal do cliente: lista apenas as próprias notas emitidas, mesmo que o pedido tente indicar outra loja.
- PDF: validação de propriedade, bloqueio de rascunhos a clientes, ausência de cache partilhada e recusa de destinos externos/conteúdo inválido.
- Dívida e valores vencidos: descontam apenas notas confirmadas e corretamente associadas. O recibo usa o remanescente bruto confirmado no Moloni.
- Wallet e Stripe: a emissão da nota não cria movimentos de saldo nem reembolsos automáticos.

## Limites da verificação

Os testes usam os módulos reais da aplicação com dependências externas simuladas. Os testes de concorrência controlam explicitamente o momento das respostas; não usam atrasos aleatórios. A unicidade e as transições de estado são simuladas na base de teste, não foram exercitadas contra PostgreSQL em produção.

Se uma operação não tiver resultado confirmado no Moloni, mantém-se protegida. Uma pesquisa vazia, por si só, não permite limpar a tentativa. Se o estado não puder ser reconciliado por consulta, é necessária confirmação junto do Moloni/suporte antes de qualquer intervenção no registo.

Ainda não foi executado um ciclo fiscal real/sandbox contra o Moloni nesta ronda. A resposta documentada para atualização foi conferida na [API oficial — creditNotes/update](https://www.moloni.pt/dev/documents/credit-notes/update).

As alterações ficaram locais; não houve commit, push ou publicação.
