# Alterar palavra-passe nos detalhes da conta

O próprio cliente encontra a secção «Segurança» nos detalhes da conta, tanto no computador como no telemóvel. O formulário pede a palavra-passe atual, uma nova de 12 a 128 caracteres e a confirmação. Mostra carregamento e erros e limpa os campos após sucesso.

O controlo não aparece para colaboradores a visualizar uma loja. A ação do servidor também recusa colaboradores, administradores e sessões sem âmbito de cliente. O email e o utilizador alvo vêm exclusivamente do contexto autenticado, nunca dos dados enviados pelo formulário.

A palavra-passe atual é verificada numa sessão Supabase Auth isolada, criada apenas com a chave pública anon. A alteração só prossegue quando o utilizador autenticado por essa palavra-passe é o mesmo da sessão TMS. Não usa o método administrativo de alteração de passwords. A sessão temporária é terminada com `scope: local`, sem substituir os cookies do navegador. Palavras-passe, tokens e erros internos do fornecedor não são devolvidos nem gravados em logs pela ação.

As verificações comuns de suspensão de acesso continuam a aplicar-se. O formulário não permite que um operador altere a palavra-passe do cliente durante a impersonação.

Validação local: 16 testes aprovados (alteração de password e navegação móvel), TypeScript, ESLint dos novos módulos e build de produção. Casos cobrem palavra-passe atual errada, identidade diferente, campos manipulados, falta de privilégios, validação, falha de atualização, limpeza da sessão temporária, visibilidade da secção e comportamento do formulário. Pré-visualizações revistas no computador e telemóvel em `output/previews/alterar-palavra-passe-*.png`.

Nenhuma palavra-passe real foi alterada durante a implementação. O fluxo real com Supabase Auth deve ser experimentado pelo utilizador com a sua conta de teste. O código necessita de publicação para ficar disponível no site.
