# Seleção manual de tabelas para novos clientes

Novos clientes começam com `assigned_linke_service_ids: []` e sem `default_linke_table_id`. O modal mostra «0 Tabelas», nenhuma caixa de serviço marcada e o seletor da tabela principal vazio.

A equipa escolhe os serviços manualmente. Escolher uma tabela principal também a inclui na lista autorizada. Desmarcar a tabela principal, ou usar «Desmarcar Todos», limpa a tabela principal. Seleções já guardadas são carregadas ao editar um cliente.

Uma lista explícita vazia significa nenhum serviço autorizado, tanto nos formulários de envio como na verificação do servidor para logins de loja. Um cliente não pode contornar esta regra enviando um serviço ou uma lista de autorizações inventada pelo navegador. Perfis antigos em que o campo de atribuições não existe conservam o comportamento anterior; não foram alterados registos reais para migrar esses perfis.

Verificação: TypeScript passou, assim como os 128 testes de segurança, incluindo bloqueio de emissão CTT/Correos e criação de rascunhos sem atribuições, e persistência de novos clientes sem tabela padrão. ESLint passou no módulo de contexto de preços e nos testes alterados. O modal foi verificado no navegador, incluindo escolha de uma única tabela e limpeza de todas, cancelando sem gravar um cliente real.
