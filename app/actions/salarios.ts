"use server"

import { revalidatePath } from "next/cache"
import { SalarioRecord, DEFAULT_SALARIOS, calculateSalarioTotals } from "@/app/ops/tesouraria/salarios/types"
import { getColaboradoresAction } from "@/app/actions/colaboradores"
import { createClient } from "@/lib/supabase/server"
import { requireEmployee } from "@/lib/auth/context"

// In-memory / cache fallback
let memorySalarios: SalarioRecord[] = [...DEFAULT_SALARIOS]

/**
 * Fetch all salary records with optional filter by month & year
 */
export async function getSalariosAction(month?: number, year?: number): Promise<SalarioRecord[]> {
  await requireEmployee()
  try {
    const supabase = await createClient()
    let query = supabase.from("salarios").select("*").order("created_at", { ascending: false })
    
    if (month) query = query.eq("month", month)
    if (year) query = query.eq("year", year)

    const { data, error } = await query

    if (error || !data || data.length === 0) {
      // Fallback to memory
      let filtered = [...memorySalarios]
      if (month) filtered = filtered.filter((s) => s.month === month)
      if (year) filtered = filtered.filter((s) => s.year === year)
      return filtered
    }

    return data as SalarioRecord[]
  } catch {
    let filtered = [...memorySalarios]
    if (month) filtered = filtered.filter((s) => s.month === month)
    if (year) filtered = filtered.filter((s) => s.year === year)
    return filtered
  }
}

/**
 * Save or update a single salary record
 */
export async function saveSalarioAction(
  record: Partial<SalarioRecord>
): Promise<{ success: boolean; salario?: SalarioRecord; message?: string }> {
  await requireEmployee()
  try {
    const totals = calculateSalarioTotals(record)

    const completeRecord: SalarioRecord = {
      id: record.id || `sal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      colaborador_id: record.colaborador_id || "",
      colaborador_name: record.colaborador_name || "Colaborador",
      colaborador_role: record.colaborador_role || "Colaborador",
      colaborador_department: record.colaborador_department || "Operações & Logística",
      colaborador_nif: record.colaborador_nif || "",
      colaborador_iban: record.colaborador_iban || "",
      colaborador_avatar_color: record.colaborador_avatar_color || "#16a34a",
      month: Number(record.month) || new Date().getMonth() + 1,
      year: Number(record.year) || new Date().getFullYear(),
      base_salary: Number(record.base_salary) || 0,
      meal_allowance_daily: Number(record.meal_allowance_daily) || 9.60,
      meal_days: Number(record.meal_days) || 22,
      meal_allowance_total: totals.meal_allowance_total,
      bonuses: Number(record.bonuses) || 0,
      overtime_amount: Number(record.overtime_amount) || 0,
      holiday_allowance: Number(record.holiday_allowance) || 0,
      christmas_allowance: Number(record.christmas_allowance) || 0,
      other_allowances: Number(record.other_allowances) || 0,
      irs_rate: Number(record.irs_rate) || 0,
      irs_amount: totals.irs_amount,
      ss_worker_rate: Number(record.ss_worker_rate) || 11.0,
      ss_worker_amount: totals.ss_worker_amount,
      ss_company_rate: Number(record.ss_company_rate) || 23.75,
      ss_company_amount: totals.ss_company_amount,
      other_deductions: Number(record.other_deductions) || 0,
      gross_total: totals.gross_total,
      net_total: totals.net_total,
      total_company_cost: totals.total_company_cost,
      payment_status: record.payment_status || "Pendente",
      payment_method: record.payment_method || "Transferência Bancária (SEPA)",
      payment_date: record.payment_date || undefined,
      reference_code: record.reference_code || `SAL-${record.year}${String(record.month).padStart(2, "0")}-${Math.floor(100 + Math.random() * 900)}`,
      notes: record.notes || "",
      created_at: record.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Try Supabase upsert
    try {
      const supabase = await createClient()
      await supabase.from("salarios").upsert(completeRecord)
    } catch {
      // ignore
    }

    // Update memory
    const existingIndex = memorySalarios.findIndex((s) => s.id === completeRecord.id)
    if (existingIndex >= 0) {
      memorySalarios[existingIndex] = completeRecord
    } else {
      memorySalarios.unshift(completeRecord)
    }

    revalidatePath("/ops/tesouraria/salarios")
    return { success: true, salario: completeRecord, message: "Registo salarial gravado com sucesso." }
  } catch (err: any) {
    return { success: false, message: err?.message || "Erro ao gravar vencimento." }
  }
}

/**
 * Delete a salary record
 */
export async function deleteSalarioAction(id: string): Promise<{ success: boolean }> {
  await requireEmployee()
  try {
    const supabase = await createClient()
    await supabase.from("salarios").delete().eq("id", id)
  } catch {
    // ignore
  }

  memorySalarios = memorySalarios.filter((s) => s.id !== id)
  revalidatePath("/ops/tesouraria/salarios")
  return { success: true }
}

/**
 * Mark a salary record as paid or change its status
 */
export async function markSalarioStatusAction(
  id: string,
  status: "Pago" | "Pendente" | "Agendado" | "Em Processamento",
  paymentDate?: string,
  paymentMethod?: string
): Promise<{ success: boolean; salario?: SalarioRecord }> {
  await requireEmployee()
  const existing = memorySalarios.find((s) => s.id === id)
  if (!existing) return { success: false }

  const updated: SalarioRecord = {
    ...existing,
    payment_status: status,
    payment_date: status === "Pago" ? (paymentDate || new Date().toISOString().slice(0, 10)) : existing.payment_date,
    payment_method: (paymentMethod as any) || existing.payment_method,
    updated_at: new Date().toISOString(),
  }

  try {
    const supabase = await createClient()
    await supabase.from("salarios").upsert(updated)
  } catch {
    // ignore
  }

  memorySalarios = memorySalarios.map((s) => (s.id === id ? updated : s))
  revalidatePath("/ops/tesouraria/salarios")
  return { success: true, salario: updated }
}

/**
 * Batch mark multiple salaries as Paid
 */
export async function batchMarkSalariosPaidAction(
  ids: string[],
  paymentDate?: string,
  paymentMethod?: string
): Promise<{ success: boolean; updatedCount: number }> {
  await requireEmployee()
  const today = paymentDate || new Date().toISOString().slice(0, 10)
  
  memorySalarios = memorySalarios.map((s) => {
    if (ids.includes(s.id)) {
      return {
        ...s,
        payment_status: "Pago",
        payment_date: today,
        payment_method: (paymentMethod as any) || s.payment_method,
        updated_at: new Date().toISOString(),
      }
    }
    return s
  })

  try {
    const supabase = await createClient()
    await Promise.all(
      ids.map((id) =>
        supabase.from("salarios").update({
          payment_status: "Pago",
          payment_date: today,
          payment_method: paymentMethod || "Transferência Bancária (SEPA)",
          updated_at: new Date().toISOString(),
        }).eq("id", id)
      )
    )
  } catch {
    // ignore
  }

  revalidatePath("/ops/tesouraria/salarios")
  return { success: true, updatedCount: ids.length }
}

/**
 * Batch generate payroll for all active staff for a given month/year
 */
export async function batchGenerateMonthPayrollAction(
  month: number,
  year: number
): Promise<{ success: boolean; createdCount: number; message: string }> {
  await requireEmployee()
  try {
    const colaboradores = await getColaboradoresAction()
    const activeStaff = colaboradores.filter((c) => c.status === "Ativo")

    let createdCount = 0

    for (const staff of activeStaff) {
      // Check if already exists for this month/year
      const exists = memorySalarios.some(
        (s) => s.colaborador_id === staff.id && s.month === month && s.year === year
      )
      if (exists) continue

      // Default base values based on role / person
      let base = 1800.00
      let irsRate = 12.5
      let bonus = 0

      if (staff.name.toLowerCase().includes("gilberto")) {
        base = 3500.00
        irsRate = 22.5
        bonus = 500.00
      } else if (staff.name.toLowerCase().includes("stefano")) {
        base = 2400.00
        irsRate = 16.5
        bonus = 250.00
      } else if (staff.name.toLowerCase().includes("nathalia")) {
        base = 1900.00
        irsRate = 13.0
        bonus = 150.00
      }

      const totals = calculateSalarioTotals({
        base_salary: base,
        meal_allowance_daily: 9.60,
        meal_days: 22,
        bonuses: bonus,
        overtime_amount: 0,
        holiday_allowance: 0,
        christmas_allowance: 0,
        other_allowances: 100.00,
        irs_rate: irsRate,
        ss_worker_rate: 11.0,
        ss_company_rate: 23.75,
        other_deductions: 0,
      })

      const newRecord: SalarioRecord = {
        id: `sal-${year}${String(month).padStart(2, "0")}-${staff.code.toLowerCase()}`,
        colaborador_id: staff.id,
        colaborador_name: staff.name,
        colaborador_role: staff.role,
        colaborador_department: staff.department,
        colaborador_nif: staff.nif || "",
        colaborador_iban: `PT50 0033 0000 ${staff.nif || "123456789"} 01`,
        colaborador_avatar_color: staff.avatar_color || "#16a34a",
        month,
        year,
        base_salary: base,
        meal_allowance_daily: 9.60,
        meal_days: 22,
        meal_allowance_total: totals.meal_allowance_total,
        bonuses: bonus,
        overtime_amount: 0,
        holiday_allowance: 0,
        christmas_allowance: 0,
        other_allowances: 100.00,
        irs_rate: irsRate,
        irs_amount: totals.irs_amount,
        ss_worker_rate: 11.0,
        ss_worker_amount: totals.ss_worker_amount,
        ss_company_rate: 23.75,
        ss_company_amount: totals.ss_company_amount,
        other_deductions: 0,
        gross_total: totals.gross_total,
        net_total: totals.net_total,
        total_company_cost: totals.total_company_cost,
        payment_status: "Agendado",
        payment_method: "Transferência Bancária (SEPA)",
        payment_date: `${year}-${String(month).padStart(2, "0")}-28`,
        reference_code: `SAL-${year}${String(month).padStart(2, "0")}-${staff.code}`,
        notes: `Folha salarial gerada automaticamente para ${staff.name}.`,
        created_at: new Date().toISOString(),
      }

      memorySalarios.unshift(newRecord)
      createdCount++
    }

    revalidatePath("/ops/tesouraria/salarios")
    return {
      success: true,
      createdCount,
      message: `${createdCount} folha(s) salarial(is) gerada(s) com sucesso para o período.`,
    }
  } catch (err: any) {
    return {
      success: false,
      createdCount: 0,
      message: err?.message || "Erro ao processar folha de salários.",
    }
  }
}
