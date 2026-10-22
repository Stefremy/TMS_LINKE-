# Plano de auditoria antes da entrega a um cliente

Guardado em: 20/10/2026  
Retoma prevista: 21/10/2026 (Europe/Lisbon)  
Estado: Passo 1 em curso. F01–F04 corrigidas localmente após autorização. Auditoria de isolamento: 93/93; segurança: 137/137; build passou. F02 validada por HTTP com sessões reais de Stef Store e GO Linke. Permissões/RLS publicadas consultadas: P01 corrigido no Supabase: execução da função de saldo bloqueada a PUBLIC/anon/authenticated e mantida para service_role, com verificação de privilégios e corpo inalterado. O site publicado não foi atualizado nesta ronda.

## Objetivo

Verificar a segurança e a integridade do TMS antes de dar acesso a um cliente, com prioridade ao isolamento entre lojas e à proteção das operações financeiras.

## Método acordado

1. Trabalhar passo a passo, explicando o que está a ser verificado.
2. Fazer primeiro a análise e distinguir problemas confirmados de suspeitas ou pontos por verificar.
3. Criar testes que reproduzam cada problema identificado, antes de o corrigir.
4. Apresentar a evidência, o impacto e a correção proposta.
5. Aguardar autorização para cada correção, uma de cada vez.
6. Validar a correção e voltar a executar os testes relevantes.

Guardar este plano não autoriza executar já a auditoria ou as correções. Não modificar a lógica de preços, os dados de produção ou as integrações com transportadoras sem validação. Os testes devem usar dados e ambientes controlados; não devem gerar cobranças, faturas, recolhas ou envios reais.

## Ordem dos trabalhos

| Passo | Área | Prioridade | Organização inicial |
| --- | --- | --- | --- |
| 1 | Isolamento entre clientes | Crítica | Semana 1 |
| 2 | Impersonação de clientes por colaboradores | Alta | Semana 1 |
| 3 | Permissões dos colaboradores | Alta | Semana 1 |
| 4 | Integridade financeira | Crítica | Semana 2 |
| 5 | Proteção de documentos financeiros | Alta | Semana 2 |
| 6 | Supabase e desempenho | Média | Semana 3 |
| 7 | Testes de regressão e validação antes dos deployments | Média | Semana 3 |

As semanas são uma proposta de organização, não uma estimativa validada de desenvolvimento.

## Passo 1 — Isolamento entre clientes

Testar envios, etiquetas, faturas, saldos e APIs para garantir que o Cliente A não consegue consultar ou alterar dados do Cliente B.

- Verificar os controlos no servidor e na base de dados, além das restrições da interface.
- Testar troca de IDs, slugs e referências nos URLs e pedidos.
- Incluir downloads, criação, edição e eliminação quando essas operações existirem.
- Confirmar a regra acordada: um login de cliente corresponde a uma loja; o acesso dos colaboradores a várias lojas depende das permissões.
- Criar testes com dois clientes/lojas distintos e comprovar a recusa de acesso cruzado.

Entrega antes de qualquer correção: relatório dos caminhos verificados, resultados, problemas reproduzidos e testes.

## Passo 2 — Reforçar a impersonação

- Validar as permissões no servidor.
- Restringir o acesso à interface de uma loja a colaboradores autorizados.
- Verificar se o cliente alvo e a empresa são validados, mesmo quando os parâmetros são manipulados.
- Verificar o registo dos acessos: quem acedeu, a que loja e quando.
- Testar tentativas de impersonação por clientes e por colaboradores sem autorização.

## Passo 3 — Rever permissões dos colaboradores

- Identificar acessos predefinidos inseguros e permissões demasiado amplas.
- Verificar que a ausência de permissão não é interpretada como autorização.
- Confirmar que a revogação tem efeito nos pedidos seguintes, incluindo sessões já iniciadas.
- Testar utilizadores sem acesso, com acesso revogado e com funções diferentes.

## Passo 4 — Corrigir integridade financeira

Analisar e reproduzir problemas antes de propor correções:

- Stripe: validação de webhooks, associação do pagamento ao cliente correto e eventos duplicados.
- Saldos e reservas de crédito: concorrência, atomicidade, confirmação e libertação após falha.
- Faturas e recibos: emissão única, associação correta e prevenção de duplicados.
- Recuperação de falhas: distinguir falha confirmada de resultado desconhecido antes de repetir operações.
- Cobrir os percursos manuais e automáticos, sem alterar a lógica de preços.

## Passo 5 — Proteger documentos financeiros

- Inventariar os ficheiros na pasta `public` e verificar eventuais dados sensíveis ou documentos internos expostos.
- Rever autorização e isolamento nos downloads, incluindo PDFs e outros anexos.
- Verificar as referências e ligações que permitem obter documentos.
- Propor a retirada ou proteção dos ficheiros identificados; não eliminar documentos sem validação.
- Não copiar credenciais, segredos ou dados pessoais para o relatório.

## Passo 6 — Otimizar Supabase e desempenho

- Identificar consultas pesadas, leituras repetidas e transferências excessivas.
- Rever paginação, seleção de colunas e limites, sem omitir registos necessários.
- Medir o impacto e propor otimizações para reduzir o egress.
- Manter os filtros de segurança em todas as consultas e páginas.

## Passo 7 — Automatizar testes de regressão

- Reunir testes de segurança, faturação e integrações CTT/Correos.
- Usar simulações ou ambientes de teste para efeitos externos.
- Registar o estado inicial de build e lint, separando problemas anteriores de regressões novas.
- Preparar verificações automáticas antes dos deployments.
- Só considerar uma área validada quando os testes e as limitações estiverem documentados.

## Estado para continuar

Começar apenas pelo **Passo 1 — Isolamento entre clientes**: analisar os caminhos de acesso, apresentar os resultados e criar testes para os problemas encontrados. Não aplicar correções antes da autorização correspondente.


Resultados da primeira ronda: [Auditoria de isolamento de 21/10/2026](CLIENT_ISOLATION_AUDIT_2026-10-21.md).

Próxima ação proposta: continuar a revisão dos filtros por empresa do catálogo e os pontos P02/P03; validar o deployment final antes de fechar o Passo 1. A P01 foi autorizada, aplicada no Supabase e verificada em 21/10/2026. A [migração de permissões](../supabase/migrations/20261021120000_restrict_increment_client_balance.sql) mantém o acesso administrativo do webhook Stripe e não altera o corpo da função nem saldos.

Resultados da F02 e da verificação real: [Supabase e duas sessões de cliente — 21/10/2026](CLIENT_ISOLATION_SUPABASE_2026-10-21.md). O login temporário da GO Linke foi criado com autorização e apagado no fim. Não houve alteração de dados comerciais.


Revisão operacional posterior: [Navegação OPS e portal — 21/10/2026](NAVIGATION_PERFORMANCE_2026-10-21.md). Rastreio automático separado da fila das ações; filtros de segurança preservados. A correção F02 reutiliza o registo autorizado na leitura dos eventos para evitar repetir a consulta do envio.

## Atualização de faturação — 22/10/2026

Foi autorizada e implementada localmente a discriminação de transporte, combustível e cada serviço especial nas novas emissões manuais e automáticas. Recupera componentes históricas sob o âmbito da loja e reconcilia exatamente o total sem IVA, sem aplicar preços atuais a envios antigos. Documentos fiscais já emitidos não são reconstruídos para adicionar linhas. Ainda precisa de publicação.

[Diagnóstico, implementação, arredondamento de IVA e validação](INVOICE_FUEL_BREAKDOWN_2026-10-22.md). Testes finais: faturação 53, recorrentes 34, segurança 138 e isolamento 93 passaram; build passou. Não houve emissão real nem alterações de saldos. Esta correção não conclui a auditoria de integridade financeira do Passo 4.

## Verificação de Stripe, wallet e recibos — 22/10/2026

Foi autorizada a verificação do ponto financeiro prioritário. Foram acrescentados 36 testes: 14 controlos passaram e 22 casos reproduziram problemas, agrupados em SW01–SW11. O diagnóstico inclui perda da etapa de crédito após pagamento, validação incompleta da associação Stripe/transação, dupla contagem de combustível, efeitos de recibos no saldo, concorrência de consumo e repetição/valor de recibos.

[Relatório, evidência, limites e ordem de correção](STRIPE_WALLET_AUDIT_2026-10-22.md). Na fase inicial, `npm run test:stripe-audit` devolvia saída 1 para reproduzir as falhas. Não foram alterados código financeiro, preços ou dados de produção. O Passo 4 continua aberto. Próxima correção proposta: SW01 com as validações de associação SW02, antes de qualquer reconciliação de pagamentos antigos.


## Correções financeiras autorizadas — 22/10/2026

SW01–SW11 implementadas localmente: liquidação Stripe atómica, associação ao checkout, montantes e âmbito da empresa, cálculo sem combustível duplicado, reservas SQL de saldo e recibos com tentativa persistida, bloqueio por fatura, recuperação e remanescente bruto Moloni. Recibos e notas de crédito partilham proteção contra operações concorrentes.

Validação: 80 testes financeiros (incluindo 20 SQL), 158 de segurança, 61 de faturação, 34 de recorrência e 36 de notas de crédito passaram — 369 no total. Build passou. [Correções, limites e passos de ativação](FINANCIAL_CORRECTIONS_2026-10-22.md).

**Pendente antes de fechar esta parte do Passo 4:** aplicar/verificar a migração e publicar o código, testar com duas ligações PostgreSQL independentes e fornecedores em ambiente de teste, e reconciliar o histórico. Não houve alteração de dinheiro ou dados comerciais de produção, emissão real, commit, push ou deployment nesta ronda.

A bateria adicional de isolamento mantém oito falhas de rastreio F03/F04 também reproduzidas em HEAD (85/93 passaram). Os testes não foram desativados e esta ronda não alterou o rastreio. A pendência está descrita no relatório das correções; não equivale a certificar o isolamento completo.
