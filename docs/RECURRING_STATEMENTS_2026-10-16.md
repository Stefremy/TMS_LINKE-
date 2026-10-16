# Extratos automáticos por período — 16/10/2026

## Utilização

Em **OPS → Faturação → Contas Correntes**, abrir **Faturação automática por período**.

Atualização v2.8.19: o fecho passa a emitir automaticamente uma fatura Moloni e a enviar os dois PDFs (fatura e extrato), conforme pedido.

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

O extrato continua a ser um documento interno. No fecho, a automação emite **uma fatura Moloni fechada**, guarda o documento no arquivo e associa os envios à fatura. A fatura fica **emitida e por pagar**, com **Emitir Recibo** disponível. O recibo é emitido apenas quando o pagamento é confirmado pela equipa. Para estas faturas automáticas, o valor do recibo é obtido do documento Moloni, incluindo impostos e deduzindo montantes já conciliados. O saldo da carteira não é debitado. Envios anteriores à ativação continuam na faturação manual.

A frequência dos ciclos usa a condição de pagamento do cliente. O vencimento da fatura usa o campo **Prazo para pagar (dias)** da ficha de cada cliente, independente da **Frequência de faturação**. Aceita 0 a 365 dias inteiros (0 = próprio dia). Para clientes sem um prazo próprio, usa o valor geral da empresa; no momento desta atualização, 7 dias. A alteração aplica-se às próximas faturas, automáticas e manuais, sem modificar documentos já emitidos. O prazo correspondente é obtido/criado no Moloni para que o PDF apresente a designação correta.

## Implementação e operação

Migração: `supabase/migrations/20261016120000_recurring_statement_cycles.sql`.

- Configuração por empresa, data inicial fixa após a primeira configuração.
- Reserva transacional por empresa/cliente/período, com bloqueio e restrição de unicidade. A data de entrada em Conta Corrente é preservada na base de dados quando a ficha é substituída, mesmo após eliminação do perfil anterior.
- Fotografias dos envios e cliente em `audit_log`, ação `period_statement`, separadas dos documentos fiscais `billing_statement`. A fatura automática tem ligação ao período e é contada apenas uma vez como documento fiscal.
- Tabelas internas com RLS e acesso apenas por `service_role`; ações e PDFs verificam sessão, permissão e empresa no servidor.
- `/api/cron/billing` exige `CRON_SECRET`. A opção `force` é rejeitada. Este endpoint emite faturas para períodos fechados e envia os dois PDFs.
- Variáveis necessárias: `CRON_SECRET`, `RESEND_API_KEY`, `STORE_FROM_EMAIL` e configuração Supabase existente. O remetente deve estar autorizado pelo serviço de email.
- A sessão Moloni é carregada por empresa com `tenantId` explícito, sem depender de cookies no agendamento.
- A reserva de envios é partilhada entre emissão manual e automática. O pedido de inserção de fatura é efetuado uma só vez, com uma referência estável do período e `status=1`; não existe repetição como rascunho. Uma resposta incerta bloqueia nova emissão e exige verificação no Moloni.
- O ID confirmado é guardado transacionalmente antes de obter o PDF. Uma falha no PDF/email não emite outra fatura. O email só avança quando os dois PDFs estão disponíveis e a fatura devolvida está fechada.
- Antes da primeira tentativa de email, o destinatário e PDFs exatos são guardados. Repetições usam o mesmo conteúdo e chave de idempotência. Só uma confirmação do fornecedor marca o email como aceite.
- Erros ficam registados, com nova tentativa após uma hora. Entregas incertas com mais de 23 horas ficam para verificação manual: a [Resend conserva as chaves de idempotência por 24 horas](https://resend.com/changelog/idempotency-keys). Não se deve reenviar cegamente depois desse limite.
- “Email aceite” confirma aceitação pelo fornecedor; não comprova leitura ou entrada na caixa principal do destinatário.
- Pode suspender/retomar no painel. A suspensão mantém o histórico e os períodos em aberto.

## Validação

- `npm run test:recurring`: 33 testes de emissão e períodos, limites, fuso horário, alterações de modalidade, concorrência, duplicados, falhas de email, períodos vazios e permissões.
- `npm run test:billing`: 21 testes, incluindo preservação da faturação Moloni e arquivo existente.
- `npm run test:security`: cobre também autorização dos PDFs dos novos extratos.
- `tests/recurring-statements.integration.sql`: executado na base de dados real com registos fictícios isolados, dentro de transação terminada com **ROLLBACK**. Valida todos os prazos, limites, valores, transições, bloqueios, recuperação e permissões.
- PDFs de 2 e 100 envios renderizados e inspecionados, incluindo a última página.

As duas migrações foram aplicadas depois dos respetivos testes transacionais. `tests/recurring-invoices.integration.sql` valida também a emissão única, conflitos manual/automático, respostas incertas, estado por pagar e permissões, com ROLLBACK. Não foram emitidas faturas fiscais fictícias em produção.

Referências da API Moloni: [inserção de fatura fechada](https://www.moloni.pt/dev/documents/invoices/insert/), [consulta do documento](https://www.moloni.pt/dev/documents/documents/getone/) e [prazos de pagamento](https://www.moloni.pt/dev/settings/maturity-dates/insert/).
