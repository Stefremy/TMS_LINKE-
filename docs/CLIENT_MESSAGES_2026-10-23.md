# Caixa de mensagens do cliente

A Área do Cliente passa a ter uma caixa persistente em `/app/<loja>/mensagens`, com histórico paginado, filtros por tipo, mensagens lidas/não lidas e ligação ao envio, fatura ou carregamento. O sino é comum ao cabeçalho de desktop e telemóvel e mostra apenas contagens reais.

## Avisos disponíveis

- Informações enviadas pela Linke através de `/ops/mensagens` → selecionar cliente, assunto e texto → **Enviar aviso**.
- Fatura oficial disponibilizada e recibo confirmado.
- Carregamento pago **e creditado**; uma referência Multibanco pendente não produz uma confirmação.
- Nova incidência de um envio.
- Ajuste efetivamente aplicado ao escalão de peso, incluindo peso/preço anterior, novo valor e diferença. O aviso não provoca nem repete a cobrança.

Os eventos automáticos são gravados por triggers a partir dos registos existentes. A unicidade de `(tenant_id, client_id, source_key)` evita repetir mensagens do mesmo evento. A migração não cria avisos retroativos: o histórico começa nos eventos posteriores à instalação.

## Acesso e leitura

A API valida a sessão e a empresa em cada pedido. Um cliente só pode consultar e marcar mensagens da loja vinculada ao seu login, mesmo alterando UUIDs, filtros ou cursores. Os RPCs e tabelas não aceitam acesso direto de `anon` ou `authenticated`.

O estado de leitura pertence ao utilizador autenticado. Um colaborador a consultar uma loja não marca as mensagens do cliente como lidas. Mensagens só aparecem como lidas depois da confirmação do servidor; falhas mantêm-nas por ler.

O envio manual exige administrador ou colaborador com **Gestão de Clientes & Contratos** / **Acesso Total (Super-Admin)**. Não há envio de email nem conversa com resposta nesta versão. O texto é simples; não aceita HTML executável nem destinos externos.

## Desempenho e integração

- Um único contador partilhado por portal, com consulta resumida sem corpos das mensagens, primeira consulta adiada e atualização a cada 90 segundos enquanto o separador está visível.
- Histórico em páginas de 20 mensagens, com cursor por data e UUID; filtros pesquisam todo o histórico.
- Marcação de até 50 mensagens apresentadas por pedido, isolada por cliente e utilizador.
- Envio manual mantém uma chave de idempotência para repetir um pedido cuja resposta se tenha perdido sem duplicar o aviso.
- Falhas de notificação não fazem rollback de pagamentos, faturas ou tracking. O PostgreSQL regista um aviso técnico sem conteúdo da mensagem; o evento original permanece disponível para recuperação. Não existe worker de reenvio automático nesta versão.

## Instalação

Aplicar `supabase/migrations/20261023180000_client_messages.sql` depois das migrações existentes de wallet/faturação e publicar o código. A versão atual do RPC de listagem inclui o filtro por categoria e substitui a assinatura anterior. O script pode ser reaplicado sem apagar mensagens ou estados de leitura.

Sem a migração, a compatibilidade existente apresenta uma caixa vazia; enviar ou marcar como lida devolve erro e não simula gravação. A migração não foi executada na base publicada durante este trabalho, nem foram enviados avisos a clientes reais.

## Verificação

`tests/client-messages.test.cjs` cobre API, isolamento, origem dos pedidos, permissões, conteúdos, contagens, paginação e falhas de leitura na interface. `tests/client-messages-sql.test.cjs` executa o SQL em PostgreSQL isolado (PGlite), cobrindo leitura por login, isolamento entre lojas, idempotência, filtros, triggers, permissões e rollback. Ambos integram `npm run test:security`.
