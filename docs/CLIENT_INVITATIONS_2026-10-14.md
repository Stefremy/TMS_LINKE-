# Convites para a Área do Cliente

## Para quem gere as lojas

Ao criar uma loja em **Ops → Entidades → Clientes → Novo Cliente**, um administrador pode escolher **Enviar convite de acesso ao criar a loja**, preencher o email do cliente e clicar em **Gravar e enviar convite**.

A loja é gravada primeiro. Depois, o convite é preparado e enviado. Se o envio falhar, aparece **Loja gravada, mas o convite não foi enviado**, com a indicação do problema. Uma nova tentativa no mesmo formulário reutiliza o identificador da loja, evitando criar outra loja.

Para uma loja já existente: abrir os detalhes do cliente e clicar em **Enviar email de palavra-passe**, no bloco **Acesso à Área do Cliente**. Abre-se uma janela para confirmar o email de login e clicar novamente em **Enviar email de palavra-passe**. O mesmo painel continua disponível no menu **Definir Acesso Portal** da lista. Não é preciso gravar o formulário de detalhes para abrir esse painel; alterações não gravadas ao email de contacto não mudam o acesso. Um novo convite permite escolher uma nova palavra-passe para a mesma conta e a mesma loja. A palavra-passe anterior só muda quando o cliente confirma a nova.

O cliente abre **Definir palavra-passe** no email, escreve a nova palavra-passe duas vezes e guarda. Depois, entra no login da Área do Cliente com esse email e a palavra-passe escolhida. A Linke não precisa de conhecer a palavra-passe. O modo manual anterior continua disponível para administradores, como opção explícita.

## Situação atual e configuração necessária

O código está preparado localmente. **Não foi enviado nenhum convite nem criada nenhuma conta durante a implementação e os testes.** O utilizador informou que ainda não tem alojamento/URL público confirmado.

O ambiente local tem `RESEND_API_KEY` e `STORE_FROM_EMAIL` preenchidos. `CLIENT_PORTAL_ORIGIN` foi configurado como `http://localhost:3000` para testes no mesmo computador. O destinatário terá de abrir o email neste computador enquanto o servidor local estiver ativo. Para clientes externos, configurar uma origem pública HTTPS depois da publicação.

Uma consulta de diagnóstico ao Resend confirmou que a chave está limitada a envio de emails; a listagem de domínios foi recusada com `restricted_api_key`. Não foi possível confirmar por essa consulta se o remetente está verificado. Nenhum email foi enviado e nenhuma permissão da chave foi alterada. O primeiro envio real continua a depender da validade do remetente e das condições do fornecedor. O envio falha antes de criar um acesso quando as configurações obrigatórias estão em falta.

Antes do primeiro envio real:

1. Publicar o projeto num alojamento acessível pelos clientes, com HTTPS.
2. Definir `CLIENT_PORTAL_ORIGIN` com a origem pública, por exemplo `https://app.toke.pt`, sem `/app` no fim. O exemplo depende de configurar o domínio e o alojamento; nenhum DNS foi alterado.
3. Confirmar que `RESEND_API_KEY` funciona e que `STORE_FROM_EMAIL` é um remetente verificado no Resend. Desativar o rastreio de cliques dos emails de autenticação para preservar os links.
4. Confirmar no Supabase a validade/expiração dos tokens e as políticas de palavras-passe. O formulário exige 12 a 128 caracteres; políticas adicionais do Supabase continuam a aplicar-se.
5. Fazer um primeiro teste real com uma loja e um email de cliente indicados pelo administrador, incluindo receção, ativação, login, isolamento de outra loja e reenvio.

Para desenvolvimento, uma origem HTTP em `localhost`/`127.0.0.1` é permitida apenas fora de produção. Não serve para um cliente externo abrir o portal no seu computador.

## Proteções implementadas

- Só administradores verificados no servidor podem enviar convites ou gerir acessos manuais. A interface também esconde estas opções dos restantes operadores.
- A loja deve existir no registo da empresa, ter um perfil gravado, estar ativa e não estar eliminada. Dados de demonstração não autorizam convites.
- Emails da equipa, contas de outra loja, contas de outra empresa e contas sem associação verificável são recusados. A pesquisa de utilizadores é paginada. A validação consulta também os registos persistidos de colaboradores no `audit_log`; esta instalação ainda não tem a tabela `colaboradores` (confirmado por consulta apenas de leitura, com `PGRST205`). Só a ausência reconhecida dessa tabela permite continuar por esse caminho. Falhas de ligação, permissões, colunas e consulta dos registos continuam a bloquear a operação. Esta compatibilidade não atribui nem altera funções de acesso.
- Contas novas usam `generateLink` do tipo `invite`; contas já associadas à mesma loja usam `recovery` para reenvio. Não se define uma palavra-passe temporária. Antes de enviar, grava-se `role: client`, `client_id` e `tenant_id` em metadados geridos pelo servidor.
- O registo `client_portal_invitation_requested` identifica loja, destinatário e administrador. Regista o pedido antes do envio; não representa confirmação de entrega. Não contém link, token ou palavra-passe.
- O endereço do email vem da configuração do servidor. Não se aceitam destinos/hosts enviados pelo formulário.
- O token fica no fragmento do link, é capturado em memória e retirado da barra de endereço. Não é enviado em URLs HTTP, guardado em armazenamento do navegador, devolvido ao administrador ou registado pelo código da aplicação.
- Abrir a página não consome o convite. A confirmação acontece apenas no POST ao guardar a palavra-passe. O Supabase valida o token e a sua validade/uso único.
- A alteração de palavra-passe usa uma sessão temporária da conta verificada pelo token, com a chave pública do Supabase. Não usa a chave administrativa para alterar a palavra-passe e não substitui a sessão aberta no navegador.
- A identidade é verificada novamente antes da alteração. Uma sessão de administrador, token de outro tipo, associação inválida ou loja inativa não pode usar este fluxo. Campos `role`, `client_id` ou redirecionamentos forjados no pedido são ignorados.
- Falhas do fornecedor e da base de dados não mostram respostas técnicas, tokens ou mensagens de sucesso falsas.
- A gravação de lojas verifica erros de persistência, rejeita IDs de outra empresa e só remove os perfis anteriores depois de gravar o novo. A gravação envolve várias operações, sem uma transação única; erros intermédios são apresentados para permitir uma nova tentativa.

## Validação

Testes isolados com fornecedores simulados, sem acesso à rede, contas reais, emails reais ou palavras-passe reais. Incluem permissões, tenant/loja, contas da equipa e de outras lojas, paginação, configuração do URL, falhas de envio/persistência e confirmação por token. A entrega real e a configuração externa de domínio/remetente ainda precisam de validação depois da publicação.

- `npm run test:security`: 104 testes passaram, incluindo 12 testes iniciais de convites, quatro testes de compatibilidade/verificação dos registos de colaboradores e um teste adicional de persistência de lojas.
- `npm run build`: passou, incluindo a verificação TypeScript.
- ESLint dos novos módulos de convites, confirmação, formulário de palavra-passe e modal de acesso: passou. Existem problemas de lint anteriores noutras partes do projeto.
- Navegador: confirmou-se a opção de convite, o campo de email e o botão **Gravar e enviar convite**. Um fragmento fictício permitiu verificar a captura/remoção do token na página de ativação; sem fragmento, o formulário indica que é necessário abrir o email e bloqueia a confirmação. Nenhuma palavra-passe foi introduzida nem nenhum formulário de persistência/envio foi submetido.
- A correção da validação de email passou também no TypeScript e ESLint. Foi verificada no Supabase real com um email fictício, apenas por consultas, sem criar/alterar contas, passwords ou enviar emails. O build acima refere-se ao passo inicial; não foi repetido para esta correção.
- O botão de email nos detalhes do cliente e a abertura do painel de confirmação foram verificados no navegador, com o email pré-preenchido da loja de teste. TypeScript e lint do painel passaram. Nenhum botão final de envio foi premido. Esta alteração de interface reutiliza a ação administrativa já testada; não altera as permissões ou o mecanismo de recuperação.

Referências oficiais consultadas: [Supabase generateLink](https://supabase.com/docs/reference/javascript/auth-admin-generatelink), [verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp) e [emails de autenticação, pré-carregamento e rastreio de links](https://supabase.com/docs/guides/auth/auth-email-templates).
