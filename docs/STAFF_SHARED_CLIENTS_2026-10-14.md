# Clientes partilhados pela equipa Linke — 14/10/2026

## Regra de acesso

As contas de administrador e colaborador da Linke consultam o mesmo registo de clientes da empresa. O autor da criação não é um filtro de acesso. Um login de loja continua limitado à sua própria loja e não recebe acesso a Ops.

## Diagnóstico

O utilizador e a colega indicaram que usam `https://tms-linke.vercel.app/login`, em computadores diferentes. A consulta de leitura à base de dados configurada no projeto local confirmou que as duas contas indicadas têm papéis de equipa: administrador e colaborador. Ambas resolvem a empresa Linke no código local.

A base de dados local configurada contém JOIAS BRILHANTES e não contém um cliente atualmente chamado Stefano teste. Isto não prova se a versão publicada utiliza a mesma configuração, nem identifica sozinho a causa do cliente em falta. Foi pedido ao utilizador que confirmasse onde o criou, o nome do cliente da colega e que iniciasse sessão na janela de verificação da Vercel.

O login público da Vercel ainda apresenta o aspeto anterior às alterações locais de separação dos logins. O código anterior de gravação ignorava erros devolvidos pelo Supabase e podia devolver sucesso mesmo sem persistência; a interface acrescentava então o cliente à lista daquele navegador. A gravação local já verifica estes erros. Essa falha é uma hipótese para o caso relatado, pendente de confirmação na publicação.

O utilizador esclareceu depois que criou Stefano teste em localhost e a colega criou o seu cliente numa versão anterior publicada. Confirmou também que já vê o cliente da colega com a conta de administrador. Isso confirma o acesso partilhado entre as duas contas; a razão específica da ausência de Stefano teste não foi determinada. Localhost e Vercel podem usar a mesma base de dados remota: criar localmente não torna, por si só, o cliente privado.

## Alterações locais desta revisão

- A listagem carrega todas as páginas do registo e dos perfis da empresa; foram retirados os limites anteriores de 50 clientes e 100 eventos.
- Os filtros usam a empresa da sessão, sem filtrar pelo colaborador que criou o cliente.
- Erros de consulta impedem apresentar uma lista incompleta como se estivesse correta. O ecrã de Clientes oferece uma mensagem de indisponibilidade e uma tentativa de carregar novamente.
- Foram acrescentados testes com duas sessões independentes, gravação e leitura pelo outro colega, isolamento dos logins de loja, falhas de gravação e consulta e mais de 1.000 registos.

O conjunto de segurança passou com 125 testes e a compilação de produção passou. Os testes novos e o ecrã de erro passaram no ESLint. Não foram criados clientes reais, alteradas credenciais ou permissões, recuperados clientes eliminados ou publicados dados na Vercel durante esta verificação. A correção local e a investigação da versão publicada são etapas distintas.
