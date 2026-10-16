# Prompt — Design System TMS Linke (Cursor / v0)

Cola tudo o que está abaixo da linha no Cursor (modo Agent) ou no v0.

---

## Contexto

Esta app é o TMS da Linke (Next.js + Tailwind, em `tms-linke.vercel.app/ops`). Quero um redesign visual de TODAS as páginas com um design system único, estilo "SaaS premium" (referências: Linear, Vercel, shadcn/ui), sem mudar a lógica, os dados, as rotas nem as chamadas à API. Só UI.

Objetivo: parecer um produto moderno, limpo e coerente. Uma só cor de marca (verde Linke), muitos neutros, hierarquia feita com tipografia e espaço.

## Regras gerais

- NÃO alterar lógica de negócio, queries Supabase, server actions, rotas ou nomes de campos.
- Usar shadcn/ui (instalar o que faltar: button, card, badge, input, select, table, tabs, dialog, dropdown-menu, popover, calendar, tooltip, skeleton, command, sheet, separator).
- Usar só ícones `lucide-react`, tamanho 16px (`size-4`), `strokeWidth={1.5}`. 20px apenas em ícones de cabeçalho de página.
- Criar os tokens em `globals.css` (CSS variables) e `tailwind.config` e usá-los em todo o lado. Nada de cores hardcoded nos componentes.
- Remover todos os estilos soltos: botões pretos, laranja, roxo, cartões escuros no tema claro, estilos "neumorphic".
- Toda a UI em português de Portugal, sentence case (ex.: "Envios registados", não "ENVIOS REGISTADOS").

## 1. Tipografia

- Fonte: `Geist` (via `next/font` ou pacote `geist`) para todo o texto. `Geist Mono` apenas para códigos (LTK…, EQ…PT, refs) e colunas numéricas de tabelas.
- Escala (px): 12 / 13 / 14 / 16 / 20 / 28 / 36.
  - Texto base: 14px, peso 400.
  - Labels e texto secundário: 13px, peso 500, cor `muted-foreground`.
  - Título de cartão: 16px, peso 600.
  - Título de página: 28px, peso 600, `tracking-tight`.
  - KPI principal: 36px, peso 600, `tracking-tight tabular-nums`.
  - KPI secundário: 20px, peso 600, `tabular-nums`.
- Não usar peso 700. Não usar MAIÚSCULAS com letter-spacing em labels (exceto cabeçalhos de tabela: 12px, peso 500, `uppercase tracking-wide`, cor muted).
- Números sempre em formato PT: `798,89 €` (usar `Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })`). Datas `16/10/2026` ou relativas ("há 2 dias") — escolher um padrão por contexto e manter.

## 2. Cores (tokens)

Tema claro:
```css
--background: #FAFAFA;
--card: #FFFFFF;
--border: #E4E4E7;        /* zinc-200 */
--input: #E4E4E7;
--foreground: #18181B;    /* zinc-900 */
--muted-foreground: #71717A; /* zinc-500 */
--muted: #F4F4F5;         /* zinc-100 */

--primary: #0F7A4A;       /* verde Linke */
--primary-hover: #0A5C37;
--primary-soft: #E8F5EE;  /* fundos leves, item ativo */
--primary-foreground: #FFFFFF;
--ring: #0F7A4A;

/* Estados — só em badges, dots e gráficos */
--success: #16A34A;  /* Entregue */
--info: #2563EB;     /* Em trânsito / Em distribuição */
--warning: #D97706;  /* Pendente / Aguarda entrada */
--danger: #DC2626;   /* Incidência / Erro */
--neutral: #71717A;  /* Rascunho / Cancelado */
```

Tema escuro (class `dark`):
```css
--background: #09090B;   /* zinc-950 */
--card: #111113;
--border: rgba(255,255,255,0.08);
--foreground: #FAFAFA;
--muted-foreground: #A1A1AA;
--primary: #34D399;
--primary-soft: rgba(52,211,153,0.10);
```

Regra: a única cor "de marca" visível em botões, links, item ativo e gráfico principal é o `--primary`. Tudo o resto é neutro.

## 3. Superfícies, raio, sombra, espaçamento

- Cartão padrão (criar `<Card>` único e usá-lo em todo o lado):
  `rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]`
- Hover em cartões clicáveis: `hover:border-zinc-300 transition-colors duration-150`.
- Raio: 12px cartões, 8px botões/inputs/selects, `rounded-full` só em badges e avatares.
- Grelha de 8px. Padding de cartão: `p-6`. Gap entre cartões: `gap-4` (16px) dentro de secções, `gap-8` (32px) entre secções.
- Conteúdo principal: `max-w-[1440px] mx-auto px-8 py-8`.
- Sem cartões dentro de cartões (no máximo um `bg-muted` interno para agrupar).

## 4. Componentes

### Botões (só 3 variantes + destrutivo)
- `primary`: `bg-primary text-white hover:bg-primary-hover`
- `secondary`: `bg-white border border-border text-foreground hover:bg-muted`
- `ghost`: `text-muted-foreground hover:bg-muted hover:text-foreground`
- `destructive`: só para apagar.
- Altura 36px (`h-9 px-4 text-sm font-medium rounded-lg`), ícone à esquerda `size-4`. Botões pequenos em tabelas: `h-8`.
- Uma só ação primária por ecrã. Remover CTAs duplicados (ex.: "Novo Serviço / Tabela" + "Novo Serviço" → fica um).

### Badges de estado (componente `<StatusBadge status=…>`)
- Formato: pill, `h-6 px-2.5 text-xs font-medium`, ponto colorido de 6px + texto, fundo a 10% da cor, sem borda.
- Mapeamento fixo:
  - Entregue → success
  - Em trânsito, Em distribuição → info
  - Pendente, Aguarda entrada → warning
  - Incidência, Devolvido → danger
  - Rascunho, Cancelado, Faturado → neutral
- Formatar sempre o texto ("Em_transito" → "Em trânsito"). Máximo 1 badge de estado por linha; info extra (Faturado, EMO) passa a ícone com tooltip.

### Inputs / Selects / Datas
- Substituir todos os `<select>` e `<input type="date">` nativos por shadcn `Select`, `Combobox` (com pesquisa, para clientes e serviços) e `DateRangePicker` (Popover + Calendar) com presets: Hoje, 7 dias, Este mês, Mês anterior.
- Altura 36px, `rounded-lg border-input`, foco `ring-2 ring-primary/20 border-primary`.
- Labels acima, 13px peso 500. Texto de ajuda/erro abaixo, 12px.

### Tabelas
- shadcn `Table`. Cabeçalho `bg-muted/50`, 12px uppercase muted. Linhas `h-14`, `hover:bg-muted/40`, divisores `border-border`.
- Texto da célula 14px; segunda linha 13px muted (ex.: código EQ por baixo do LTK).
- Códigos em `font-mono text-[13px]` com botão de copiar no hover.
- Moradas: mostrar só "4800-019 Guimarães"; morada completa em tooltip.
- Coluna de ações fixa à direita (`sticky right-0 bg-card`), com `DropdownMenu` (ícone `MoreHorizontal`) em vez de vários botões.
- A tabela nunca pode sair do cartão: `overflow-x-auto` no wrapper.

### Tabs / filtros rápidos
- shadcn `Tabs` estilo segmentado: `bg-muted p-1 rounded-lg`, tab ativa `bg-white shadow-sm`. Contagem ao lado em muted: "Todos 31".

### Estados vazios e loading
- Estado vazio: ícone 20px dentro de quadrado `size-10 rounded-lg bg-muted`, título 16px/600, descrição 14px muted, um botão primário. (As páginas Recolhas e Incidências já estão perto disto — uniformizar.)
- Loading: `Skeleton` com a forma do conteúdo. Nada de spinners em páginas inteiras.

## 5. Layout global

### Sidebar
- Largura 248px, `bg-card border-r`. Logo no topo (altura 28px), versão "v2.8.17" em 12px muted ao lado ou removida.
- Grupos ("Operação", "Gestão", "Sistema") em 12px peso 500 muted, sentence case.
- Item: `h-9 px-3 rounded-lg text-sm`, ícone 16px. Ativo: `bg-primary-soft text-primary font-medium`. Hover: `bg-muted`.
- Itens expansíveis com `ChevronDown` alinhado à direita, animação 150ms.
- Encurtar labels para uma linha: "Serviços & Tabelas de Preço" → "Tabelas de preço".
- Remover "Novo Envio" da sidebar (fica só o botão primário no topo).
- Botão "Recolher painel" em ghost, rodapé da sidebar.

### Topbar
- Altura 56px, `bg-card/80 backdrop-blur border-b`, sticky.
- Esquerda: breadcrumb da página atual.
- Centro/esquerda: barra de pesquisa global estilo `⌘K` (shadcn `Command`) — pesquisa envios por LTK, EQ, cliente.
- Direita: botão primário "Novo envio", notificações, ajuda (ghost icon buttons 36px), avatar com dropdown (perfil, terminar sessão).
- Remover o link "Tracking & Mapa" duplicado da topbar (já está na sidebar).

### Cabeçalho de página (componente `<PageHeader>` igual em TODAS as páginas)
- Fora de cartão, diretamente no fundo.
- Título 28px/600 + descrição 14px muted por baixo.
- Ações à direita (máx. 1 primária + 2 secundárias).
- Opcional: tabs da página logo abaixo, alinhadas à esquerda.

## 6. Página a página

### Dashboard (/ops)
- Remover o ticker de ações/crypto e o relógio analógico.
- Remover o botão flutuante "Calculadora Neumorphic" (mover para um item no menu "Ferramentas" ou um `Sheet`).
- PageHeader: "Visão geral" + DateRangePicker com presets à direita.
- Linha 1 — 3 KPIs principais (grid 3 col): Receitas, Margem, Taxa de entrega. Cada um: label 13px muted, valor 36px, variação vs. período anterior (badge pequeno verde/vermelho com seta), sparkline de 32px de altura em `--primary`. Tooltip (ícone `Info`) a explicar o cálculo.
- Linha 2 — 3 KPIs secundários compactos (grid 3 col, cartões mais baixos): Envios registados, Entregas à 1ª, Tempo médio.
- Linha 3 — grid 3 col: gráfico "Lucro acumulado" (col-span-2) + "Estado atual" (col-span-1).
  - Gráfico: linha do mês atual em `--primary` com área em gradiente (primary 15% → 0%), meses anteriores em zinc-300 tracejado. Legenda clicável em pills. Esconder meses sem dados. Variação em valor absoluto quando a base for < 100 € ("+669 €" em vez de "+30472%").
  - Estado atual: lista vertical com dot de estado, nome, contagem à direita; zeros em muted; Incidências > 0 em danger. Cada linha clicável (sem "Ver →").
- Linha 4 — grid 3 col: "Envios recentes" (col-span-2, tabela com 5 linhas) + "Último rastreamento" (col-span-1, com timeline vertical: Recolhido → Em trânsito → Em distribuição → Entregue, passo atual em primary).
- Notícias: passar para um cartão compacto no fim ou um `Sheet` lateral aberto por um botão. Datas no formato relativo uniforme.

### Envios (/ops/envios)
- PageHeader "Envios" + ações: "Novo envio" (primary), "Recolhas" (secondary), menu "Ferramentas" (secondary com chevron).
- Toolbar num só nível: pesquisa (esquerda, 320px), Tabs de estado (Todos, Pendentes, Em trânsito, Entregues, Incidências) com contagens, filtro avançado em `Popover` (direita).
- Tabela conforme secção 4. Colunas: Guia (LTK + EQ por baixo), Remetente, Destinatário (nome + "CP Localidade"), Serviço (só um badge neutro curto, ex.: "Económico 48h"), Volumes/Peso, Entrega (data ou "—"), Estado, Valor (alinhado à direita, mono), Ações (menu).
- Seleção múltipla com barra de ações flutuante no fundo quando há linhas selecionadas.
- Paginação shadcn no rodapé do cartão.

### Novo envio (/ops/envios/novo)
- Layout em 2 colunas: formulário (col-span-2) + resumo sticky à direita (col-span-1) com preço estimado grande, custo, margem, serviço escolhido e botão primário "Criar envio".
- Formulário dividido em secções com título 16px/600 e separador: 1) Cliente e serviço, 2) Remetente, 3) Destinatário, 4) Volumes e dimensões.
- Serviço: em vez de select, cartões selecionáveis (radio cards) com nome, prazo e preço.
- Dimensões: Comp. / Larg. / Alt. numa só linha de 3 inputs com sufixo "cm"; Peso com sufixo "kg".
- Remetente: cartão `bg-muted` com morada e botão ghost "Alterar".

### Tracking & Mapa (/ops/tracking)
- Corrigir texto: "Pickagens" → "Picagens".
- Remover a barra informativa "Posto de Controlo de Rastreio…" (passar a tooltip no título).
- Layout 3 colunas mantido, mas com gap-4 e cartões padrão: lista de envios (320px) | mapa (flex-1, `rounded-xl overflow-hidden`) | detalhe (360px).
- Cartões da lista: LTK em mono, StatusBadge, origem → destino com seta simples, ETA em 13px muted. Ativo: `border-primary ring-1 ring-primary/20`.
- Painel de detalhe: progresso (barra 6px `bg-primary`), timeline vertical de picagens, especificações em lista `dl` 2 colunas.
- Mapa: estilo de tiles claro/neutro (ex.: CartoDB Positron), marcador em primary, labels sem sobreposição. Botões do mapa em secondary 32px com ícone.
- Badges e chips nunca quebram linha (`whitespace-nowrap`).

### Recolhas (/ops/envios/recolhas) e Incidências (/ops/incidencias)
- Aplicar PageHeader padrão (sem cartão à volta do cabeçalho).
- Badge "Multi-Operadora" → badge neutro.
- "Lista de recolhas" → secondary; "Nova recolha" → primary.
- KPIs de incidências: usar o mesmo componente de KPI secundário do dashboard; ícones em `bg-muted` (não coloridos), cor só quando valor > 0.

### Calendário (/ops/calendario)
- PageHeader "Calendário" + à direita: navegação de mês (ghost icon buttons + label "Outubro 2026") e botão primary "Adicionar evento".
- Filtros (feriados PT/ES, equipa) numa só linha abaixo, como chips toggle.
- Grelha: células com `border-border`, dia atual com número em círculo `bg-primary text-white`, fins de semana `bg-muted/40`, feriados com dot e texto 12px que pode ocupar 2 linhas (tooltip com o nome completo).

### Relatórios (/ops/relatorios)
- É a página de referência — só alinhar com os tokens (fonte, cores, KPI component, DateRangePicker com presets).

### Serviços & Tabelas (/ops/configuracao/servicos)
- Tabs principais (Tabelas de preço / Matriz de margens / Simulador) logo abaixo do PageHeader.
- Uma só ação "Novo serviço" (primary) no PageHeader; remover a duplicada.
- Lista da esquerda: cartões compactos, ativo com `border-primary`. Detalhe à direita com secções separadas por `Separator`.
- Atalhos de margem (+18%, +20%…): segmented control; o selecionado em `bg-primary text-white`.

### Documentos (/ops/documentos)
- A rota dá 404. Criar a página com PageHeader e estado vazio padrão, ou remover o item da sidebar.
- Criar também uma `not-found.tsx` com o design system (logo, mensagem, botão "Voltar à visão geral").

### Portal público (/tracking)
- Hero centrado com gradiente subtil (ver secção 7), título 36px/600, input grande (h-12) com botão primary "Rastrear" sempre em cor cheia (não usar estado desativado como aspeto padrão).
- Abaixo: 3 passos ilustrados com ícones (Recolhido → Em trânsito → Entregue), bloco de FAQ (Accordion) e contacto.
- Header com logo legível (altura 28px) e link "Área de cliente" em secondary.
- Footer em 13px muted.

## 7. Toque moderno "AI SaaS"

- Gradiente radial muito subtil no topo do dashboard e do portal público:
  `bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,theme(colors.emerald.100/.6),transparent)]` (no dark: `emerald-500/10`).
- Números dos KPIs animam ao carregar (count-up 600ms, ease-out), respeitando `prefers-reduced-motion`.
- Transições de 150–200ms em hover, tabs e dropdowns. Nada de animações longas.
- Skeletons em todos os carregamentos.
- Command palette `⌘K` funcional (pesquisar envios e navegar para páginas).
- Toggle de tema claro/escuro no menu do avatar (usar `next-themes`).
- Focus states visíveis (`ring-2 ring-primary/30`) em todos os elementos interativos.

## 8. Critérios de aceitação

- Todas as páginas usam: a mesma fonte, os mesmos tokens de cor, o mesmo `<Card>`, `<PageHeader>`, `<StatusBadge>`, `<Button>` (3 variantes).
- Zero `<select>` / `<input type="date">` nativos visíveis.
- Zero cores fora dos tokens (procurar por `#`, `bg-black`, `bg-orange`, `bg-purple` e substituir).
- Nenhum texto ou tabela a sair do contentor a 1280px e 1440px de largura; layout utilizável a 768px.
- Contraste mínimo AA (4.5:1) em todo o texto.
- Lógica, rotas e dados intactos — testar criar envio, filtrar envios e abrir tracking depois do redesign.

Trabalha por fases e mostra-me o resultado no fim de cada uma:
1. Tokens, fonte e componentes base (Button, Card, Badge, StatusBadge, PageHeader, inputs).
2. Sidebar, topbar e layout global.
3. Dashboard.
4. Envios e Novo envio.
5. Restantes páginas e portal público.
