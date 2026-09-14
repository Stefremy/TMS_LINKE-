"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"
import { Colaborador, DEFAULT_COLABORADORES } from "@/app/ops/entidades/colaboradores/types"

const LINKE_TENANT_ID = "11111111-1111-1111-1111-111111111111"

/**
 * Obtém todos os colaboradores registados
 */
export async function getColaboradoresAction(): Promise<Colaborador[]> {
  const supabase = createAdminClient()
  const colaboradoresMap = new Map<string, Colaborador>()

  // 1. Carregar valores padrão (Stefano, Nathalia, Gilberto)
  DEFAULT_COLABORADORES.forEach((col) => {
    colaboradoresMap.set(col.id, { ...col })
  })

  // 2. Tentar ler da tabela colaboradores do Supabase (se existir)
  try {
    const { data: dbCols, error } = await supabase
      .from("colaboradores")
      .select("*")
      .order("created_at", { ascending: true })

    if (!error && dbCols && dbCols.length > 0) {
      dbCols.forEach((c: any) => {
        colaboradoresMap.set(c.id, {
          ...c,
          permissions: Array.isArray(c.permissions) ? c.permissions : typeof c.permissions === "string" ? JSON.parse(c.permissions) : [],
        })
      })
    }
  } catch (err: any) {
    // Tabela pode ainda não ter sido criada no schema cache
  }

  // 3. Ler de audit_log para persistência de alterações recentes
  try {
    const { data: logs } = await supabase
      .from("audit_log")
      .select("*")
      .in("action", ["colaborador_created", "colaborador_updated", "colaborador_deleted"])
      .order("created_at", { ascending: true })

    if (logs && logs.length > 0) {
      logs.forEach((log: any) => {
        if (log.action === "colaborador_deleted" && log.details?.id) {
          colaboradoresMap.delete(log.details.id)
        } else if (log.details?.id) {
          const prev = colaboradoresMap.get(log.details.id) || {}
          colaboradoresMap.set(log.details.id, {
            ...prev,
            ...log.details,
          })
        }
      })
    }
  } catch (err: any) {
    console.warn("[getColaboradoresAction] Audit log query warning:", err?.message)
  }

  return Array.from(colaboradoresMap.values()).sort((a, b) => a.code.localeCompare(b.code))
}

/**
 * Cria ou atualiza um colaborador
 */
export async function saveColaboradorAction(colaboradorData: Partial<Colaborador> & { name: string; role: string; department: string }) {
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const id = colaboradorData.id || `col-${colaboradorData.name.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now().toString().slice(-4)}`
  const code = colaboradorData.code || `COL00${Math.floor(Math.random() * 90 + 10)}`

  const fullColaborador: Colaborador = {
    id,
    code,
    name: colaboradorData.name,
    role: colaboradorData.role,
    department: colaboradorData.department,
    email: colaboradorData.email || `${colaboradorData.name.toLowerCase().replace(/\s+/g, ".")}@linkelogistics.pt`,
    phone: colaboradorData.phone || "910000000",
    mobile_phone: colaboradorData.mobile_phone || colaboradorData.phone || "910000000",
    nif: colaboradorData.nif || "",
    status: colaboradorData.status || "Ativo",
    access_level: colaboradorData.access_level || "Operacional",
    agency_location: colaboradorData.agency_location || "Sede - Felgueiras / Guimarães",
    admission_date: colaboradorData.admission_date || now.slice(0, 10),
    avatar_color: colaboradorData.avatar_color || "#16a34a",
    permissions: colaboradorData.permissions || ["Acesso Operacional"],
    emergency_contact: colaboradorData.emergency_contact || "",
    notes: colaboradorData.notes || "",
    created_at: colaboradorData.created_at || now,
    updated_at: now,
  }

  // 1. Tentar gravar na tabela colaboradores
  try {
    await supabase.from("colaboradores").upsert({
      id: fullColaborador.id,
      tenant_id: LINKE_TENANT_ID,
      code: fullColaborador.code,
      name: fullColaborador.name,
      role: fullColaborador.role,
      department: fullColaborador.department,
      email: fullColaborador.email,
      phone: fullColaborador.phone,
      mobile_phone: fullColaborador.mobile_phone,
      nif: fullColaborador.nif,
      status: fullColaborador.status,
      access_level: fullColaborador.access_level,
      agency_location: fullColaborador.agency_location,
      admission_date: fullColaborador.admission_date,
      avatar_color: fullColaborador.avatar_color,
      permissions: fullColaborador.permissions,
      emergency_contact: fullColaborador.emergency_contact,
      notes: fullColaborador.notes,
      updated_at: now,
    }, { onConflict: "id" })
  } catch (err: any) {
    // Ignorar se a tabela ainda não existir
  }

  // 2. Dual-write to audit_log
  try {
    await supabase.from("audit_log").insert({
      tenant_id: LINKE_TENANT_ID,
      action: colaboradorData.id ? "colaborador_updated" : "colaborador_created",
      details: fullColaborador,
      created_at: now,
    })
  } catch (err: any) {
    console.warn("Audit log insert warning:", err?.message)
  }

  revalidatePath("/ops/entidades/colaboradores")
  return { success: true, colaborador: fullColaborador }
}

/**
 * Remove um colaborador
 */
export async function deleteColaboradorAction(id: string) {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  try {
    await supabase.from("colaboradores").delete().eq("id", id)
  } catch {}

  try {
    await supabase.from("audit_log").insert({
      tenant_id: LINKE_TENANT_ID,
      action: "colaborador_deleted",
      details: { id },
      created_at: now,
    })
  } catch {}

  revalidatePath("/ops/entidades/colaboradores")
  return { success: true }
}

/**
 * Altera o estado do colaborador (Ativo / Inativo / Férias)
 */
export async function toggleColaboradorStatusAction(id: string, status: "Ativo" | "Inativo" | "Férias") {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  try {
    await supabase.from("colaboradores").update({ status, updated_at: now }).eq("id", id)
  } catch {}

  try {
    await supabase.from("audit_log").insert({
      tenant_id: LINKE_TENANT_ID,
      action: "colaborador_updated",
      details: { id, status, updated_at: now },
      created_at: now,
    })
  } catch {}

  revalidatePath("/ops/entidades/colaboradores")
  return { success: true }
}
