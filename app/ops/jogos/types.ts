import type { OpsGameId, OpsGamesDashboardData, OpsGameScoreRecord, OpsTeamMemberStats } from "@/app/actions/ops-games"

export type { OpsGameId, OpsGamesDashboardData, OpsGameScoreRecord, OpsTeamMemberStats }

export interface GameCompletionEvent {
  gameId: OpsGameId
  score: number
  level: number
  timeMs: number
  moves: number
  metadata?: Record<string, unknown>
}

export interface GameInfo {
  id: OpsGameId
  title: string
  subtitle: string
  category: string
  description: string
  iconName: string
  color: string
  bgColor: string
  borderColor: string
}

export const OPS_GAMES: GameInfo[] = [
  {
    id: "flow_lines",
    title: "Linhas & Fluxos",
    subtitle: "Conectar Nós sem Cruzar",
    category: "Lógica Espacial",
    description: "Ligue os pares de cores iguais desenhando linhas sem cruzar. Preencha todo o tabuleiro para a pontuação máxima!",
    iconName: "GitCommit",
    color: "#059669",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
  },
  {
    id: "one_stroke",
    title: "Traço Único",
    subtitle: "Circuito de Linha Contínua",
    category: "Geometria",
    description: "Percorra todas as arestas da figura geométrica num único traço contínuo sem nunca repetir o mesmo caminho.",
    iconName: "PenTool",
    color: "#2563eb",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  {
    id: "number_path",
    title: "Rota Numérica",
    subtitle: "Caminho Zip Sequencial",
    category: "Raciocínio",
    description: "Crie uma rota contínua ligando os números em ordem (1 ➔ 2 ➔ 3...). Complete todas as etapas no menor tempo.",
    iconName: "Milestone",
    color: "#d97706",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
  },
  {
    id: "memory_matrix",
    title: "Matriz de Memória",
    subtitle: "Retenção de Padrões Visuais",
    category: "Memória",
    description: "Memorize o padrão de células que acendem no tabuleiro e reproduza-o com precisão. A dificuldade sobe a cada nível!",
    iconName: "BrainCircuit",
    color: "#7c3aed",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
  },
  {
    id: "speed_math",
    title: "Cálculo Rápido",
    subtitle: "Agilidade Mental Operacional",
    category: "Velocidade",
    description: "60 segundos de cálculos mentais rápidos e pesagens logísticas. Acerte em sequência para disparar o multiplicador de combo!",
    iconName: "Zap",
    color: "#dc2626",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/30",
  },
]

