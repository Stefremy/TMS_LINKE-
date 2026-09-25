export interface Colaborador {
  id: string
  code: string
  name: string
  role: string
  department: string
  email: string
  phone: string
  mobile_phone?: string
  nif?: string
  status: "Ativo" | "Inativo" | "Férias"
  access_level: "Administrador" | "Operacional" | "Comercial / Suporte"
  agency_location: string
  admission_date: string
  avatar_color: string
  permissions: string[]
  emergency_contact?: string
  notes?: string
  created_at: string
  updated_at?: string
}

export const DEPARTMENTS = [
  "Direção Executiva",
  "Operações & Logística",
  "Atendimento & Clientes",
  "Financeiro & Faturação",
  "Comercial & Vendas",
  "Tecnologia & Sistemas",
] as const

export const ACCESS_LEVELS = [
  "Administrador",
  "Operacional",
  "Comercial / Suporte",
] as const

export const DEFAULT_COLABORADORES: Colaborador[] = [
  {
    id: "col-stefano-001",
    code: "COL001",
    name: "Stefano",
    role: "Gestão de Operações & Sistemas",
    department: "Operações & Logística",
    email: "stefano.remy@gmail.com",
    phone: "910000001",
    mobile_phone: "910000001",
    nif: "245123987",
    status: "Ativo",
    access_level: "Administrador",
    agency_location: "Sede - Felgueiras / Guimarães",
    admission_date: "2023-01-01",
    avatar_color: "#16a34a", // emerald
    permissions: [
      "Acesso Operacional & Admin",
      "Gestão de Contratos e Clientes",
      "Emissão e Controlo de Guias CTT",
      "Configuração de Webservices & API",
      "Supervisão de Operações de Transporte"
    ],
    emergency_contact: "+351 910 000 001",
    notes: "Gestão operacional, sistemas de transporte e supervisão da plataforma TMS Linke Logistics.",
    created_at: "2023-01-01T09:00:00Z"
  },
  {
    id: "col-nathalia-002",
    code: "COL002",
    name: "Nathalia",
    role: "Gestão de Clientes & Faturação",
    department: "Atendimento & Clientes",
    email: "nathalia@linkelogistics.pt",
    phone: "910000002",
    mobile_phone: "910000002",
    nif: "256789123",
    status: "Ativo",
    access_level: "Administrador",
    agency_location: "Sede - Felgueiras / Guimarães",
    admission_date: "2023-03-15",
    avatar_color: "#9333ea", // purple
    permissions: [
      "Gestão e Onboarding de Clientes",
      "Gestão de Contas Correntes & Faturação",
      "Atendimento & Suporte a Incidências",
      "Acesso a Envios & Histórico de Destinatários",
      "Gestão de Pedidos de Recolha CTT"
    ],
    emergency_contact: "+351 910 000 002",
    notes: "Responsável pelo acompanhamento de clientes, contas correntes, faturação e gestão de incidências de transporte.",
    created_at: "2023-03-15T09:00:00Z"
  },
  {
    id: "col-gilberto-003",
    code: "COL003",
    name: "Gilberto",
    role: "CEO & Diretor Geral",
    department: "Direção Executiva",
    email: "gilberto@linkelogistics.pt",
    phone: "910000003",
    mobile_phone: "910000003",
    nif: "238912456",
    status: "Ativo",
    access_level: "Administrador",
    agency_location: "Sede - Felgueiras / Guimarães",
    admission_date: "2023-01-01",
    avatar_color: "#2563eb", // blue
    permissions: [
      "Acesso Total (Super-Admin)",
      "Direção Executiva & Estratégia",
      "Gestão de Contratos e Clientes",
      "Aprovação Financeira & Tarifários",
      "Supervisão Global de Operações"
    ],
    emergency_contact: "+351 910 000 003",
    notes: "CEO da Linke Logistics, direção executiva global e supervisão estratégica da empresa.",
    created_at: "2023-01-01T09:00:00Z"
  }
]
