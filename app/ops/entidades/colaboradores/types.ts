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
  avatar?: string
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
    role: "Super-Admin / Gestão Geral & Sistemas",
    department: "Direção Executiva",
    email: "stefano.remy@gmail.com",
    phone: "916723469",
    mobile_phone: "916723469",
    nif: "245123987",
    status: "Ativo",
    access_level: "Administrador",
    agency_location: "Sede - Felgueiras / Guimarães",
    admission_date: "2023-01-01",
    avatar_color: "#16a34a", // emerald
    permissions: [
      "Acesso Total (Super-Admin)",
      "Gestão de Clientes & Contratos",
      "Emissão e Controlo de Guias CTT",
      "Pedidos de Recolha & Distribuição",
      "Faturação & Contas Correntes",
      "Gestão de Transportadoras & Frotas",
      "Configurações de Webservices & Integrações"
    ],
    emergency_contact: "+351 916 723 469",
    notes: "Super-Administrador com acesso total e irrestrito a todos os módulos do TMS.",
    created_at: "2023-01-01T09:00:00Z"
  },
  {
    id: "col-geral-002",
    code: "COL002",
    name: "Geral",
    role: "Operações & Logística",
    department: "Operações & Logística",
    email: "geral@linke.pt",
    phone: "910000002",
    mobile_phone: "910000002",
    nif: "256789123",
    status: "Ativo",
    access_level: "Operacional",
    agency_location: "Sede - Felgueiras / Guimarães",
    admission_date: "2023-03-15",
    avatar_color: "#2563eb", // blue
    permissions: [
      "Emissão e Controlo de Guias CTT",
      "Pedidos de Recolha & Distribuição",
      "Gestão de Transportadoras & Frotas"
    ],
    emergency_contact: "+351 910 000 002",
    notes: "Conta operacional da equipa de operações e logística.",
    created_at: "2023-03-15T09:00:00Z"
  },
  {
    id: "col-clientes-003",
    code: "COL003",
    name: "Clientes",
    role: "Atendimento & Suporte a Clientes",
    department: "Atendimento & Clientes",
    email: "clientes@linke.pt",
    phone: "910000003",
    mobile_phone: "910000003",
    nif: "238912456",
    status: "Ativo",
    access_level: "Comercial / Suporte",
    agency_location: "Sede - Felgueiras / Guimarães",
    admission_date: "2023-01-01",
    avatar_color: "#9333ea", // purple
    permissions: [
      "Gestão de Clientes & Contratos",
      "Atendimento & Suporte a Incidências"
    ],
    emergency_contact: "+351 910 000 003",
    notes: "Conta de suporte ao cliente, incidências e gestão de contas correntes.",
    created_at: "2023-01-01T09:00:00Z"
  }
]
