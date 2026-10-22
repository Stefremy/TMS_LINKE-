# Suspensão de acesso à Área do Cliente

Implementação local em 22/10/2026, sem bloquear contas reais durante o desenvolvimento.

Na ficha de um cliente existente, os administradores encontram o controlo de acesso no fundo do modal. «Bloquear Cliente» pede confirmação; a confirmação grava a alteração imediatamente, independentemente de «Gravar Cliente». O mesmo controlo passa a «Reativar Cliente». A suspensão é separada de `is_active`, dos preços e das condições comerciais.

## Persistência e autorização

- Estado em `audit_log`, ação `client_portal_access`, com `details.id`, `blocked` e `changed_by`. Preserva o histórico das decisões e usa a infraestrutura existente; não requer novas tabelas.
- As ações de leitura/alteração do controlo exigem `requireAdmin()` e verificam o cliente no tenant autenticado. Dados do formulário ou parâmetros enviados pelo navegador não atribuem privilégios.
- O contexto de autenticação comum verifica a decisão mais recente para sessões de cliente, incluindo sessões abertas antes do bloqueio. Sem cache de autorização entre pedidos. Falhas de leitura recusam o acesso.
- Os colaboradores mantêm o acesso operacional. As alterações não modificam envios, saldos, faturas ou o perfil comercial.
- A página pública `/conta-suspensa` não carrega dados do cliente nem exige o contexto bloqueado, evitando ciclos de redirecionamento. Mostra «A sua conta foi suspensa» e um contacto por email para `geral@linke.pt`.
- O fluxo de login preserva o redirecionamento Next.js para o aviso, em vez de o apresentar como erro de palavra-passe.

O bloqueio aplica-se aos pedidos ao TMS e não apaga dados já apresentados numa janela anteriormente aberta. A reativação é efetiva no pedido seguinte; um cliente reativado pode voltar a iniciar sessão normalmente.

## Validação

Testes cobrem uma sessão existente bloqueada, isolamento por tenant/cliente, reativação e novo bloqueio sem cache, falha de leitura, acesso operacional, rejeição de alterações por clientes/colaboradores sem administração, auditoria do autor e falha de gravação. O controlo visual foi testado para confirmação, estado de carregamento e reativação. O login suspenso chega ao aviso correto.

Build de produção e TypeScript aprovados. Pré-visualizações verificadas no computador e telemóvel em `output/previews/`. Nenhuma conta de produção foi bloqueada e nenhum email foi enviado. É necessário publicar o código para disponibilizar esta funcionalidade no site.
