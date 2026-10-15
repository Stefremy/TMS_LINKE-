# Revisão móvel — OPS e Área do Cliente

## 1. Resumo e âmbito

Revisão do código da navegação comum, listas de envios, contas correntes e modais de saldo, conta, detalhe de envio, recibo, email e ligação Moloni. Base: commit `8a34fa3`.

As duas áreas já tinham menus móveis e cartões de envios. Foram preservados os percursos existentes e as condições que permitem apenas aos colaboradores voltar ao OPS a partir do portal.

**Limitação:** a ferramenta de inspeção do navegador não conseguiu estabelecer ligação. Esta revisão confirma implementação e comportamento simulado, sem capturas nem observação visual de um telemóvel. Não confirma que todas as páginas estejam visualmente prontas.

## 2. Avaliação

Não são atribuídas pontuações de 0–100. Design visual, experiência, eficácia das ações, experiência móvel, acessibilidade, conteúdo e consistência têm evidência visual insuficiente para uma classificação global. Não foram medidos Core Web Vitals, contraste ou conformidade WCAG.

## 3. Problemas encontrados e alterações

Todos os itens abaixo foram observados no código. O benefício esperado é uma hipótese de usabilidade, sem métricas de conversão.

| Problema e local | Gravidade | Alteração | Benefício esperado | Esforço |
|---|---|---|---|---|
| Navegação passava a desktop aos 768 px, incluindo muitos telemóveis na horizontal. Layouts OPS/cliente. | Alta | Política comum de desktop: largura de pelo menos 1024 px e altura de pelo menos 500 px. Listas seguem a mesma política. | Manter navegação e cartões adequados ao espaço disponível. | Médio |
| Perfil e rodapé do menu ficavam fora da região de scroll. | Alta | Todo o conteúdo do menu percorre uma região única; o cabeçalho e o botão de fechar permanecem acessíveis. | Facilitar encontrar opções em ecrãs baixos. | Pequeno |
| Menus usavam sobreposição e bloqueio de scroll sem tratamento próprio do foco. | Alta | Componente comum com `dialog` modal nativo, foco inicial no fecho, reposição do foco e do bloqueio anterior; fecha ao selecionar uma ligação ou mudar para desktop. | Evitar interação com a página atrás do menu. | Médio |
| Barra inferior tinha altura fixa incluindo o espaço de segurança do dispositivo. | Média | Altura inclui a margem de segurança; conteúdo reserva espaço correspondente. Na horizontal, ícones e texto ficam lado a lado. | Libertar altura e evitar tapar os últimos elementos. | Pequeno |
| Modais de saldo/recibos/email podiam exceder a altura útil. | Alta | Altura máxima dinâmica, scroll interno e margens laterais/superiores/inferiores de segurança. | Permitir alcançar campos e ações finais. | Pequeno |
| Grelha de faturação mantinha doze colunas em ecrãs estreitos. | Média | Cliente, totais e ação distribuem-se por linhas móveis; filtros podem mudar de linha. | Evitar nomes, valores e botões sobrepostos. | Pequeno |
| Lista OPS impunha altura baseada em `100vh`, criando scroll adicional no telefone. | Média | Cartões usam scroll natural da página; desktop mantém a tabela com scroll próprio e altura dinâmica. | Tornar o gesto de percorrer a lista mais previsível. | Pequeno |
| Controlos de navegação eram pequenos e as áreas de segurança laterais não eram consideradas. | Média | Alvos de navegação maiores, foco visível, margens de segurança e texto de campos a 16 px em dispositivos de toque. | Melhorar precisão ao tocar e leitura dos campos. | Pequeno |

Não foram inventados dez problemas para preencher uma lista.

## 4. Páginas e componentes

- `/ops`: navegação, cabeçalho e conteúdo comuns.
- `/ops/envios`: alternância de cartões/tabela, cabeçalho e scroll.
- `/ops/faturacao/contas-corrente`: grelha, filtros e modais.
- `/app/[storeSlug]`: navegação, cabeçalho, ações e lista de envios.
- `/app/[storeSlug]/envios`: cartões e tabela.
- Modais do cliente: saldo, conta e detalhe do envio.

Os restantes formulários e páginas internas não foram avaliados visualmente.

## 5. Revisão visual móvel pendente

Tamanhos de referência para confirmação num navegador/dispositivo, **ainda não executada**:

- Vertical: 360×800, 390×844 e 412×915.
- Horizontal: 740×360, 844×390 e 932×430.
- Tablet/desktop: 1024×768 e 1366×768.

Confirmar nomes longos, filtros, cartões, arquivo por loja, abertura/fecho de menus, rotação com menu aberto, teclado virtual, campos monetários e chegada ao último botão dos modais.

## 6. Eficácia dos percursos

A prioridade neste produto é concluir tarefas: criar e consultar envios, carregar saldo e consultar/emitir documentos. As alterações procuram tornar essas ações acessíveis sem mudar as regras comerciais. Não foram simulados pagamentos nem emitidos documentos reais nesta revisão.

## 7. Decisões de design

Preservadas as cores, tipografia e identidade existentes. Foi privilegiada a consistência dos modos móvel/desktop, espaço para conteúdo em ecrãs baixos, agrupamento dos controlos e rolagem previsível. Não foi feita uma mudança de marca. No menu do cliente, abrir os detalhes da conta fecha primeiro a navegação e apresenta o formulário fora do menu.

## 8. Cinco melhorias imediatas aplicadas

1. Mesma transição de layout nos dois portais e nas listas.
2. Menus com conteúdo integralmente percorrível.
3. Barras inferiores com espaço reservado e variante horizontal compacta.
4. Modais limitados à altura disponível.
5. Faturação em linhas adaptáveis em vez de doze colunas móveis.

## 9. Próximos passos

- Concluído neste trabalho: testes automáticos e compilação. A matriz visual continua pendente.
- Próximos sete dias, quando houver acesso ao navegador: executar a matriz visual acima e corrigir os problemas observados.
- Próximos trinta dias: aplicar os mesmos padrões aos formulários e tabelas ainda não revistos, conforme o uso real.
- Posteriormente: avaliar com operadores e clientes se navegação e filtros reduzem passos nas tarefas habituais. Sem calendário automático criado.

## 10. Referências e validação técnica

- [Componente de menu](../components/ui/mobile-drawer.tsx), [estilos comuns](../app/globals.css) e [testes de navegação](../tests/mobile-navigation.test.cjs).
- [MDN: dialog](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) — comportamento modal, foco e fundo inativo delegados ao navegador; não substitui testes reais.
- [MDN: env()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env) — margens de segurança do dispositivo.
- Consultadas as instruções locais do Next.js 16.3.4 para CSS, componentes cliente/servidor e viewport.

Comandos de validação: `npm run test:mobile`, `npm run test:billing`, `npm run test:security`, `npm run build`, ESLint do novo componente e `git diff --check`. Resultados: 8 testes móveis, 18 de faturação/arquivo e 131 de segurança aprovados; compilação, ESLint do novo componente e verificação do diff aprovados. A verificação visual em navegador/dispositivo continua pendente.
