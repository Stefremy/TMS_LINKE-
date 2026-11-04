# Supabase — revisão de recursos e erros

Data: 4 de novembro de 2026, manhã, Europe/Lisbon. Projeto: rcifuhiwemwlatgserva.

## Conclusão

CPU, disco e ligações têm folga. A instância Nano apresenta pressão de memória; o próprio painel oferece Micro com 1 GB ao mesmo preço por hora ($0.01344). Há desperdício verificável nas consultas ao audit_log e chamadas repetidas a recursos ausentes no esquema/API.

## Medições e períodos

| Medição | Resultado | Período/âmbito |
|---|---|---|
| CPU, cartão Database | 1.93% | 3–4 novembro, aproximadamente 09:52–09:52 |
| Memory usage, cartão Database | 423.37 MB | Mesmo intervalo de 24 horas; inclui as séries apresentadas no painel, não equivale só à memória de queries |
| Memory commitment | 1.27 GB; SEVERE | Mesmo intervalo; compromissos do kernel, distintos da RAM efetivamente residente |
| Disco | 17%; cerca de 0.32 GB / 2 GB | Infrastructure, inclui WAL e sistema |
| Ligações de clientes | 7 / max_connections 60; 1 ativa | Snapshot SQL; inclui a própria consulta de diagnóstico |
| Transações ociosas abertas | 0 | Snapshot SQL |
| Cache hit da base de dados | 100% arredondado | Estatísticas acumuladas desde 25 agosto |
| Egress | 1.819 GB | Ciclo 22 outubro–22 novembro, parcial até à consulta |
| Utilizadores ativos | 8 | Mesmo ciclo de faturação |

As métricas de rede, IOPS e ligações não carregaram no relatório Database. Não se deve interpretar a ausência como zero. Infrastructure mostrou Disk IO balance 99% no seu resumo de sete dias; não é uma medição de pico segundo a segundo. O tamanho Database apresentado nos cartões (cerca de 64 MB) divergiu de pg_database_size (50 MB); são leituras com atualização/âmbito diferentes, e nenhuma indica pressão de espaço.

## Principais fontes de desperdício

1. **audit_log domina o tempo de execução medido.** pg_stat_statements: 3,804.79 s ligados a queries com referência normalizada a public.audit_log / 4,292.62 s totais = aproximadamente 88.6%. Acumulado desde **7 setembro 2026**, não apenas nas últimas 24 horas. A consulta mais cara representa 58.5% no ranking, 5,216 chamadas, média 451 ms e máximo 7,970 ms.
2. **Só existe o índice da chave primária em audit_log.** Os filtros recorrentes usam action, tenant_id, created_at e identificadores JSON. Há 105,637 scans sequenciais acumulados e 5,884 leituras por índice; esses números não provam, isoladamente, que cada scan seja inadequado. A combinação com grandes payloads e o ranking justifica rever índices e projeções.
3. **Dados pesados dentro do JSON.** audit_log ocupa cerca de 36 MB. O grupo shipment_data tem 190 registos, cerca de 27 MB armazenados de JSON e 12 MB de texto no campo ctt_label_base64. O código faz dual-write e lê details completo em vários caminhos. A tabela guarda dados operacionais reais, não apenas registos descartáveis.
4. **Chamadas inválidas repetidas.** Na amostra da última hora, 12 respostas 404, alternando carrier_connections de CTT e Correos aproximadamente a cada 10 minutos. Também foram observados 404 para colaboradores, servicos_linke e user_profiles e 400 para shipments.ctt_manifest_pdf. Verificação GET de projeção vazia confirmou PGRST205 nos quatro recursos; a mesma chave/configuração aponta para o projeto auditado.
5. **Colunas CTT ausentes.** information_schema confirmou que shipments.ctt_manifest_pdf e shipments.ctt_object_id não existem; carrier_tracking_number existe. A migração 20260908130000_ctt_integration.sql contém definições relevantes. Rever dependências e compatibilidade antes de aplicar outras migrações.

## Erros e alcance

O Overview das últimas 24 horas mostrou 2,354 warnings no API Gateway e 155 erros Postgres; 0 erros 5xx no API Gateway. O resumo misto mostrou 27,598 eventos/pedidos e 90.9% success rate. Esse agregado mistura tipos de logs e não mede disponibilidade da aplicação nem percentagem de envios falhados. Muitos 404 são tratados pelos fallbacks do código, mas continuam a gerar chamadas e logs desnecessários.

## Prioridades

1. Aproveitar a opção Nano → Micro ao mesmo custo apresentado, numa janela que permita o reinício breve da base de dados. A alteração de compute ainda não foi executada nesta auditoria.
2. Alinhar esquema e código, começando pelos recursos/colunas ausentes; remover tentativas de leitura repetidas que falham e caem no fallback em cada execução.
3. Rever índices compostos/parciais do audit_log conforme os filtros reais; medir antes/depois com os mesmos parâmetros.
4. Mover gradualmente etiquetas/documentos binários para Storage e devolver apenas os campos necessários nas listagens; preservar os dados e referências existentes.
5. Agrupar leituras de tracking e medições e usar cache curta onde apropriado. Os logs mostram várias leituras sequenciais por envio; a frequência e o volume total devem ser medidos antes de quantificar a poupança.

Não há evidência para réplicas, aumento de disco ou instância grande nesta revisão.

## Fontes

- [Database observability](https://supabase.com/dashboard/project/rcifuhiwemwlatgserva/observability/database)
- [Query performance](https://supabase.com/dashboard/project/rcifuhiwemwlatgserva/observability/query-performance)
- [Infrastructure e opções Nano/Micro](https://supabase.com/dashboard/project/rcifuhiwemwlatgserva/settings/infrastructure)
- [Logs](https://supabase.com/dashboard/project/rcifuhiwemwlatgserva/logs)
- [Usage do projeto](https://supabase.com/dashboard/org/euhqlfkxjajdxfmtwxfh/usage?projectRef=rcifuhiwemwlatgserva)
- [Supabase: compute e disk](https://supabase.com/docs/guides/platform/compute-and-disk)
- [Supabase: interpretação de memória e commitment](https://supabase.com/docs/guides/observability/reports#memory-commitment)

Diagnóstico SQL executado em transações BEGIN READ ONLY com statement_timeout de 10 segundos. Consultados pg_settings, pg_stat_database, pg_stat_activity, pg_stat_user_tables, pg_indexes, information_schema, extensions.pg_stat_statements_info e extensions.pg_stat_statements; agregações de tamanho por action sem exportar conteúdo operacional ou credenciais.

## Alterações aplicadas — 4 novembro 2026

- Nano → Micro confirmado no painel: 1 GB de memória, mesma tarifa $0.01344/h. O diálogo apresentou $9.68/mês antes e depois, diferença $0.00, antes de impostos. O reinício terminou e as leituras autenticadas da base de dados voltaram a responder.
- Aplicada `supabase/migrations/20261104110000_database_query_efficiency.sql`: seis índices no audit_log e RPC de capacidades do esquema, executável apenas pelo service_role. Não altera registos de negócio nem move documentos. A migração foi testada também num Postgres temporário, incluindo reaplicação e privilégios.
- Antes/depois no mesmo Micro, com cache aquecida, para uma pesquisa real de snapshot por empresa/ID: LIMIT actual time 23.094–23.097 ms e 4,262 buffers shared hit antes; 0.062–0.063 ms e 5 shared hit depois. O plano passou a Index Scan usando audit_log_tenant_action_entity_idx. Trata-se de uma consulta de diagnóstico, que seleciona apenas id; não mede a latência integral das páginas nem garante esse fator em todas as consultas.
- Leituras opcionais de credenciais, diretório, serviços e perfil consultam metadados do esquema, com cache de cinco minutos por projeto. O conteúdo de preços, permissões e sessões não é incluído nessa cache. Em instalações sem a nova RPC, mantém-se o comportamento anterior.
- Notificações deixam de usar a coluna ctt_manifest_pdf quando ela não existe, mantendo o filtro de subestado dos manifestos fechados.
- Atualizações específicas de snapshots filtram empresa e ID/tracking no servidor em vez de descarregar todos os JSON/etiquetas. A cache existente de credenciais Correos passou a estar isolada por empresa.
- Verificação live das credenciais CTT/Correos: carregamento correto pelos registos existentes, quatro respostas HTTP 200 e zero pedidos à tabela carrier_connections ausente. Nenhuma chamada de emissão/recolha foi efetuada nesse teste. A RPC de metadados recusou acesso anónimo.
- Produção Vercel compilada e promovida: `dpl_9Mbqk26br7zevhWrzpBBH5CHfuQP`, URL https://tms-linke-a0ucbrndc-stefremys-projects.vercel.app. Alias app.toke.pt confirmado na nova versão; /login redireciona corretamente para /app/login, ops.toke.pt/login responde 200 e o calendário sem sessão responde 401.
- Verificação posterior pela Metrics API: 978 MB de RAM física apresentada, cerca de 546 MB disponíveis, compromisso em 77.7% do limite e cerca de 41 MB de swap alocado. Snapshot pontual; swap alocado não mede atividade de paginação, e uma medição não prova estabilidade prolongada.
- Validação: 399 testes de segurança, 120 financeiros, 18 de manifestos, 30 do calendário e cinco novos testes de eficiência (572 no total); TypeScript e build de produção passaram. Novos módulos passaram ESLint. Os ficheiros legados tocados mantêm 80 erros ESLint já existentes, sem mensagens novas relativamente ao HEAD.
- Pequenas correções de validação: guarda explícita na rota do calendário antigo e fixture de três volumes ajustada ao serviço EMSF010.01 já exigido pela lógica existente.
- O pacote de publicação exclui relatórios, capturas de ecrã, documentos privados, scratch, testes e ficheiros de credenciais. As alterações de código continuam no workspace da branch feat/ops-calendar-redesign, por commit.

Impacto esperado: mais margem de memória, menos chamadas falhadas aos recursos opcionais ausentes e menos leituras de payloads pesados. Índices acrescentam espaço e manutenção nas gravações. Etiquetas continuam no armazenamento existente nesta alteração; uma migração para Storage seria trabalho separado.
