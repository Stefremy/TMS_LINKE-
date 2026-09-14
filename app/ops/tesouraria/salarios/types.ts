export interface SalarioRecord {
  id: string
  colaborador_id: string
  colaborador_name: string
  colaborador_role: string
  colaborador_department: string
  colaborador_nif?: string
  colaborador_iban?: string
  colaborador_avatar_color?: string
  month: number // 1 - 12
  year: number // e.g. 2026
  
  // Vencimentos
  base_salary: number // Vencimento Base
  meal_allowance_daily: number // Subsídio de Alimentação por dia
  meal_days: number // Dias úteis de trabalho
  meal_allowance_total: number // Total Subsídio de Alimentação
  bonuses: number // Prémios / Bónus de Desempenho
  overtime_amount: number // Horas Extraordinárias
  holiday_allowance: number // Subsídio de Férias (ou duodécimo)
  christmas_allowance: number // Subsídio de Natal (ou duodécimo)
  other_allowances: number // Outras Ajudas / Isenção de Horário
  
  // Descontos / Impostos
  irs_rate: number // Taxa de IRS em % (ex: 14.5)
  irs_amount: number // Valor Retido IRS
  ss_worker_rate: number // Taxa Segurança Social Trabalhador (11%)
  ss_worker_amount: number // Valor Segurança Social Trabalhador
  ss_company_rate: number // Taxa Segurança Social Empresa / TSU (23.75%)
  ss_company_amount: number // Valor TSU Empresa
  other_deductions: number // Outros Descontos / Adiantamentos
  
  // Totais Consolidados
  gross_total: number // Total Ilíquido / Bruto (Base + Prémios + Extras + Subsídios tributáveis)
  net_total: number // Total Líquido a Receber pelo Colaborador
  total_company_cost: number // Custo Total para a Linke Logistics (Bruto + TSU + Alimentação)
  
  // Estado e Pagamento
  payment_status: "Pago" | "Pendente" | "Agendado" | "Em Processamento"
  payment_method: "Transferência Bancária (SEPA)" | "MB Way" | "Cheque" | "Dinheiro"
  payment_date?: string
  reference_code: string // ex: SAL-202609-001
  notes?: string
  created_at: string
  updated_at?: string
}

/**
 * Pure calculation helper for salary totals
 */
export function calculateSalarioTotals(data: Partial<SalarioRecord>): {
  gross_total: number
  net_total: number
  total_company_cost: number
  meal_allowance_total: number
  irs_amount: number
  ss_worker_amount: number
  ss_company_amount: number
} {
  const baseSalary = Number(data.base_salary) || 0
  const mealDaily = Number(data.meal_allowance_daily) || 0
  const mealDays = Number(data.meal_days) || 0
  const mealAllowanceTotal = mealDaily * mealDays

  const bonuses = Number(data.bonuses) || 0
  const overtime = Number(data.overtime_amount) || 0
  const holiday = Number(data.holiday_allowance) || 0
  const christmas = Number(data.christmas_allowance) || 0
  const otherAllowances = Number(data.other_allowances) || 0
  const otherDeductions = Number(data.other_deductions) || 0

  // Gross / Ilíquido (Tributável)
  const grossTotal = baseSalary + bonuses + overtime + holiday + christmas + otherAllowances

  // Tax deductions
  const irsRate = Number(data.irs_rate) || 0
  const irsAmount = Math.round((grossTotal * (irsRate / 100)) * 100) / 100

  const ssWorkerRate = Number(data.ss_worker_rate) || 11.0
  const ssWorkerAmount = Math.round((grossTotal * (ssWorkerRate / 100)) * 100) / 100

  const ssCompanyRate = Number(data.ss_company_rate) || 23.75
  const ssCompanyAmount = Math.round((grossTotal * (ssCompanyRate / 100)) * 100) / 100

  // Net / Líquido = Gross - IRS - SS Worker + Meal Allowance - Other Deductions
  const netTotal = Math.round((grossTotal - irsAmount - ssWorkerAmount + mealAllowanceTotal - otherDeductions) * 100) / 100

  // Total Company Cost = Gross + TSU Empresa + Meal Allowance
  const totalCompanyCost = Math.round((grossTotal + ssCompanyAmount + mealAllowanceTotal) * 100) / 100

  return {
    gross_total: grossTotal,
    net_total: netTotal,
    total_company_cost: totalCompanyCost,
    meal_allowance_total: mealAllowanceTotal,
    irs_amount: irsAmount,
    ss_worker_amount: ssWorkerAmount,
    ss_company_amount: ssCompanyAmount,
  }
}

export const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const

export const DEFAULT_SALARIOS: SalarioRecord[] = [
  {
    id: "sal-202609-001",
    colaborador_id: "col-gilberto-003",
    colaborador_name: "Gilberto",
    colaborador_role: "CEO & Diretor Geral",
    colaborador_department: "Direção Executiva",
    colaborador_nif: "238912456",
    colaborador_iban: "PT50 0033 0000 4523 8912 4560 1",
    colaborador_avatar_color: "#2563eb",
    month: 9,
    year: 2026,
    base_salary: 3500.00,
    meal_allowance_daily: 9.60,
    meal_days: 22,
    meal_allowance_total: 211.20,
    bonuses: 500.00,
    overtime_amount: 0.00,
    holiday_allowance: 0.00,
    christmas_allowance: 0.00,
    other_allowances: 250.00,
    irs_rate: 22.5,
    irs_amount: 956.25, // 22.5% sobre 4250
    ss_worker_rate: 11.0,
    ss_worker_amount: 467.50, // 11% sobre 4250
    ss_company_rate: 23.75,
    ss_company_amount: 1009.38, // 23.75% sobre 4250
    other_deductions: 0.00,
    gross_total: 4250.00,
    net_total: 3037.45, // 4250 - 956.25 - 467.50 + 211.20
    total_company_cost: 5470.58, // 4250 + 1009.38 + 211.20
    payment_status: "Agendado",
    payment_method: "Transferência Bancária (SEPA)",
    payment_date: "2026-09-28",
    reference_code: "SAL-202609-001",
    notes: "Processamento salarial de Setembro 2026 - Direção Geral.",
    created_at: "2026-09-01T10:00:00Z"
  },
  {
    id: "sal-202609-002",
    colaborador_id: "col-stefano-001",
    colaborador_name: "Stefano",
    colaborador_role: "Gestão de Operações & Sistemas",
    colaborador_department: "Operações & Logística",
    colaborador_nif: "245123987",
    colaborador_iban: "PT50 0018 0000 2451 2398 7010 2",
    colaborador_avatar_color: "#16a34a",
    month: 9,
    year: 2026,
    base_salary: 2400.00,
    meal_allowance_daily: 9.60,
    meal_days: 22,
    meal_allowance_total: 211.20,
    bonuses: 250.00,
    overtime_amount: 0.00,
    holiday_allowance: 0.00,
    christmas_allowance: 0.00,
    other_allowances: 150.00,
    irs_rate: 16.5,
    irs_amount: 462.00, // 16.5% sobre 2800
    ss_worker_rate: 11.0,
    ss_worker_amount: 308.00, // 11% sobre 2800
    ss_company_rate: 23.75,
    ss_company_amount: 665.00, // 23.75% sobre 2800
    other_deductions: 0.00,
    gross_total: 2800.00,
    net_total: 2241.20, // 2800 - 462.00 - 308.00 + 211.20
    total_company_cost: 3676.20, // 2800 + 665.00 + 211.20
    payment_status: "Agendado",
    payment_method: "Transferência Bancária (SEPA)",
    payment_date: "2026-09-28",
    reference_code: "SAL-202609-002",
    notes: "Gestão operacional e supervisão técnica TMS.",
    created_at: "2026-09-01T10:00:00Z"
  },
  {
    id: "sal-202609-003",
    colaborador_id: "col-nathalia-002",
    colaborador_name: "Nathalia",
    colaborador_role: "Gestão de Clientes & Faturação",
    colaborador_department: "Atendimento & Clientes",
    colaborador_nif: "256789123",
    colaborador_iban: "PT50 0035 0000 2567 8912 3450 3",
    colaborador_avatar_color: "#9333ea",
    month: 9,
    year: 2026,
    base_salary: 1900.00,
    meal_allowance_daily: 9.60,
    meal_days: 22,
    meal_allowance_total: 211.20,
    bonuses: 150.00,
    overtime_amount: 0.00,
    holiday_allowance: 0.00,
    christmas_allowance: 0.00,
    other_allowances: 100.00,
    irs_rate: 13.0,
    irs_amount: 279.50, // 13% sobre 2150
    ss_worker_rate: 11.0,
    ss_worker_amount: 236.50, // 11% sobre 2150
    ss_company_rate: 23.75,
    ss_company_amount: 510.63, // 23.75% sobre 2150
    other_deductions: 0.00,
    gross_total: 2150.00,
    net_total: 1845.20, // 2150 - 279.50 - 236.50 + 211.20
    total_company_cost: 2871.83, // 2150 + 510.63 + 211.20
    payment_status: "Agendado",
    payment_method: "Transferência Bancária (SEPA)",
    payment_date: "2026-09-28",
    reference_code: "SAL-202609-003",
    notes: "Gestão de contas correntes e faturação de clientes.",
    created_at: "2026-09-01T10:00:00Z"
  },
  // Previous month: Agosto 2026 (Pago)
  {
    id: "sal-202608-001",
    colaborador_id: "col-gilberto-003",
    colaborador_name: "Gilberto",
    colaborador_role: "CEO & Diretor Geral",
    colaborador_department: "Direção Executiva",
    colaborador_nif: "238912456",
    colaborador_iban: "PT50 0033 0000 4523 8912 4560 1",
    colaborador_avatar_color: "#2563eb",
    month: 8,
    year: 2026,
    base_salary: 3500.00,
    meal_allowance_daily: 9.60,
    meal_days: 21,
    meal_allowance_total: 201.60,
    bonuses: 500.00,
    overtime_amount: 0.00,
    holiday_allowance: 0.00,
    christmas_allowance: 0.00,
    other_allowances: 250.00,
    irs_rate: 22.5,
    irs_amount: 956.25,
    ss_worker_rate: 11.0,
    ss_worker_amount: 467.50,
    ss_company_rate: 23.75,
    ss_company_amount: 1009.38,
    other_deductions: 0.00,
    gross_total: 4250.00,
    net_total: 3027.85,
    total_company_cost: 5460.98,
    payment_status: "Pago",
    payment_method: "Transferência Bancária (SEPA)",
    payment_date: "2026-08-28",
    reference_code: "SAL-202608-001",
    notes: "Vencimento liquidado por transferência SEPA.",
    created_at: "2026-08-01T10:00:00Z"
  },
  {
    id: "sal-202608-002",
    colaborador_id: "col-stefano-001",
    colaborador_name: "Stefano",
    colaborador_role: "Gestão de Operações & Sistemas",
    colaborador_department: "Operações & Logística",
    colaborador_nif: "245123987",
    colaborador_iban: "PT50 0018 0000 2451 2398 7010 2",
    colaborador_avatar_color: "#16a34a",
    month: 8,
    year: 2026,
    base_salary: 2400.00,
    meal_allowance_daily: 9.60,
    meal_days: 21,
    meal_allowance_total: 201.60,
    bonuses: 250.00,
    overtime_amount: 0.00,
    holiday_allowance: 0.00,
    christmas_allowance: 0.00,
    other_allowances: 150.00,
    irs_rate: 16.5,
    irs_amount: 462.00,
    ss_worker_rate: 11.0,
    ss_worker_amount: 308.00,
    ss_company_rate: 23.75,
    ss_company_amount: 665.00,
    other_deductions: 0.00,
    gross_total: 2800.00,
    net_total: 2231.60,
    total_company_cost: 3666.60,
    payment_status: "Pago",
    payment_method: "Transferência Bancária (SEPA)",
    payment_date: "2026-08-28",
    reference_code: "SAL-202608-002",
    notes: "Vencimento liquidado por transferência SEPA.",
    created_at: "2026-08-01T10:00:00Z"
  },
  {
    id: "sal-202608-003",
    colaborador_id: "col-nathalia-002",
    colaborador_name: "Nathalia",
    colaborador_role: "Gestão de Clientes & Faturação",
    colaborador_department: "Atendimento & Clientes",
    colaborador_nif: "256789123",
    colaborador_iban: "PT50 0035 0000 2567 8912 3450 3",
    colaborador_avatar_color: "#9333ea",
    month: 8,
    year: 2026,
    base_salary: 1900.00,
    meal_allowance_daily: 9.60,
    meal_days: 21,
    meal_allowance_total: 201.60,
    bonuses: 150.00,
    overtime_amount: 0.00,
    holiday_allowance: 0.00,
    christmas_allowance: 0.00,
    other_allowances: 100.00,
    irs_rate: 13.0,
    irs_amount: 279.50,
    ss_worker_rate: 11.0,
    ss_worker_amount: 236.50,
    ss_company_rate: 23.75,
    ss_company_amount: 510.63,
    other_deductions: 0.00,
    gross_total: 2150.00,
    net_total: 1835.60,
    total_company_cost: 2862.23,
    payment_status: "Pago",
    payment_method: "Transferência Bancária (SEPA)",
    payment_date: "2026-08-28",
    reference_code: "SAL-202608-003",
    notes: "Vencimento liquidado por transferência SEPA.",
    created_at: "2026-08-01T10:00:00Z"
  }
]
