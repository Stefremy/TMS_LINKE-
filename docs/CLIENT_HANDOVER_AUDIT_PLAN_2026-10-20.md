# Plano de auditoria antes da entrega a um cliente

Guardado em: 20/10/2026  
Retoma prevista: 21/10/2026 (Europe/Lisbon)  
Estado: Passo 1 em curso. F01–F04 corrigidas localmente após autorização. Auditoria de isolamento: 93/93; segurança: 137/137; build passou. F02 validada por HTTP com sessões reais de Stef Store e GO Linke. Permissões/RLS publicadas consultadas: P01 confirmado crítico na função de saldo; proposta de restrição ainda não aplicada. O site publicado não foi atualizado nesta ronda.

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

Próxima ação proposta: rever e autorizar a correção P01 das permissões da função de saldo. A inspeção publicada confirmou execução por `anon` e `authenticated` de uma função `SECURITY DEFINER` sem verificação de loja/empresa. A [proposta SQL](../supabase/audits/proposals/20261021_restrict_increment_balance.sql) preserva `service_role`, usado pelo webhook Stripe; não foi aplicada nem foi executada a função de saldo. Antes de concluir o Passo 1 continuam a faltar a resolução deste risco, a revisão dos filtros por empresa do catálogo e a validação do deployment final.

Resultados da F02 e da verificação real: [Supabase e duas sessões de cliente — 21/10/2026](CLIENT_ISOLATION_SUPABASE_2026-10-21.md). O login temporário da GO Linke foi criado com autorização e apagado no fim. Não houve alteração de dados comerciais.


Revisão operacional posterior: [Navegação OPS e portal — 21/10/2026](NAVIGATION_PERFORMANCE_2026-10-21.md). Rastreio automático separado da fila das ações; filtros de segurança preservados. A correção F02 reutiliza o registo autorizado na leitura dos eventos para evitar repetir a consulta do envio.
