# Extratos automáticos por período — 16/10/2026

## Utilização

Em **OPS → Faturação → Contas Correntes**, abrir **Extratos automáticos por período**.

- Abrange clientes ativos com **Conta Corrente**, usando a condição de pagamento atual: Pronto Pagamento (diário), 7, 15, 30, 45, 60 ou 90 dias.
- Os ciclos começam na data de ativação. Envios anteriores continuam disponíveis para faturação manual.
- Clientes criados depois começam na sua data de criação. Uma mudança de Pay as You Go/inativo para Conta Corrente inicia uma nova janela, sem recuperar o intervalo anterior.
- Datas e horários usam **Europe/Lisbon**, incluindo mudanças de hora. Cada intervalo inclui o dia inicial e termina antes do dia do fecho.
- Verificação horária, com envio entre as **09h e as 19h**. Períodos vazios avançam sem criar documento ou email.
- Destino: email de faturação, ou email principal quando o primeiro está vazio. Endereços inválidos bloqueiam a entrega.
- A simulação de uma data futura é apenas uma pré-visualização dos envios existentes; não envia emails nem fecha ciclos.
- Apenas administradores podem ativar/suspender a automação e enviar testes. O teste usa dados fictícios e o endereço introduzido.

## Arquivo e faturação

Os documentos ficam em **Cliente → Período → Extrato e envios**, junto das faturas já existentes. O PDF indica o período e os valores registados, sem inventar componentes de preço ausentes.

O extrato é interno: **não emite fatura Moloni, não debita saldo, não marca envios como faturados e não cria uma nova dívida**. A emissão fiscal continua manual, podendo selecionar os envios de um período. Envios entretanto faturados são novamente verificados e excluídos dessa seleção.

## Implementação e operação

Migração: `supabase/migrations/20261016120000_recurring_statement_cycles.sql`.

- Configuração por empresa, data inicial fixa após a primeira configuração.
- Reserva transacional por empresa/cliente/período, com bloqueio e restrição de unicidade.
- Fotografias dos envios e cliente em `audit_log`, ação `period_statement`, separadas dos documentos fiscais `billing_statement`.
- Tabelas internas com RLS e acesso apenas por `service_role`; ações e PDFs verificam sessão, permissão e empresa no servidor.
- `/api/cron/billing` exige `CRON_SECRET`. A opção `force` é rejeitada. Este endpoint emite apenas extratos internos.
- Variáveis necessárias: `CRON_SECRET`, `RESEND_API_KEY`, `STORE_FROM_EMAIL` e configuração Supabase existente. O remetente deve estar autorizado pelo serviço de email.
- Antes da primeira tentativa, o destinatário e PDF exatos são guardados. Repetições usam o mesmo conteúdo e chave de idempotência. Só uma confirmação do fornecedor marca o email como aceite.
- Erros ficam registados, com nova tentativa após uma hora. Entregas incertas com mais de 23 horas ficam para verificação manual: a [Resend conserva as chaves de idempotência por 24 horas](https://resend.com/changelog/idempotency-keys). Não se deve reenviar cegamente depois desse limite.
- “Email aceite” confirma aceitação pelo fornecedor; não comprova leitura ou entrada na caixa principal do destinatário.
- Pode suspender/retomar no painel. A suspensão mantém o histórico e os períodos em aberto.

## Validação

- `npm run test:recurring`: 19 testes de períodos, limites, fuso horário, alterações de modalidade, concorrência, duplicados, falhas de email, períodos vazios e permissões.
- `npm run test:billing`: 18 testes, incluindo preservação da faturação Moloni e arquivo existente.
- `npm run test:security`: cobre também autorização dos PDFs dos novos extratos.
- `tests/recurring-statements.integration.sql`: executado na base de dados real com registos fictícios isolados, dentro de transação terminada com **ROLLBACK**. Valida todos os prazos, limites, valores, transições, bloqueios, recuperação e permissões.
- PDFs de 2 e 100 envios renderizados e inspecionados, incluindo a última página.

A migração foi aplicada depois dos testes transacionais. A ativação operacional e o envio de teste devem ser confirmados na interface publicada.
