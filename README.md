# Linke TMS

Aplicação Next.js com autenticação Supabase e dados no Postgres.

## Desenvolvimento

1. Copiar `.env.example` para `.env.local` e configurar as variáveis no ambiente local.
2. Executar `npm ci` e `npm run dev`.
3. Aplicar as migrações em `supabase/migrations` no projeto Supabase antes de publicar alterações de base de dados.

## Consultas de envios

`getShipmentsAction({ includeLabels: false })` lê as vistas `shipment_metadata` e `shipment_audit_metadata`, que retiram etiquetas PDF/ZPL e manifestos antes da transferência do Postgres. A área de cliente pede a etiqueta apenas ao imprimir ou descarregar. O código recorre às tabelas originais durante a instalação da migração; nessa fase a transferência da base de dados ainda não fica reduzida.

A migração `20260929120000_shipment_audit_metadata.sql` acrescenta a vista, a função de leitura individual da etiqueta e índices para as consultas de envios e clientes. Verificar no Supabase as métricas de egress, as consultas mais lentas e o plano de execução depois de aplicar a migração. A listagem continua a carregar todos os envios e deve ser paginada no servidor quando o volume crescer.

O rastreio público procura apenas códigos exatos e consulta no máximo um envio de cada origem. Não cria dados de demonstração. O endpoint `/api/test-providers` não aceita GET e só executa testes por POST para um administrador quando `ENABLE_PROVIDER_TESTS=true`.

## Webhook CTT

Configurar `CTT_WEBHOOK_SECRET` com um valor aleatório forte no ambiente de produção. O emissor do webhook tem de enviar `Authorization: Bearer <segredo>`. Sem o segredo e as variáveis Supabase, o endpoint responde 503. Se a origem CTT não suportar este cabeçalho, colocar um adaptador autenticado entre a origem e o endpoint antes de ativar esta integração.

## Verificação

`npx tsc --noEmit` verifica os tipos; `npm run build` verifica a compilação. `npm run lint` assinala problemas preexistentes que devem ser corrigidos por módulos.
