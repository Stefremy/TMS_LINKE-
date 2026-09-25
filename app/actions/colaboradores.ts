"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"
import { Colaborador, DEFAULT_COLABORADORES } from "@/app/ops/entidades/colaboradores/types"
import { requireEmployee, getTenantId } from "@/lib/auth/context"


/**
 * Obtém todos os colaboradores registados
 */
export async function getColaboradoresAction(): Promise<Colaborador[]> {
  await requireEmployee()

  const supabase = createAdminClient()
  const colaboradoresMap = new Map<string, Colaborador>()

  // 1. Obter apenas os utilizadores com conta real no Supabase Auth
  try {
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers()
    if (!usersError && usersData?.users) {
      usersData.users.forEach((u: any, index: number) => {
        // Ignorar clientes externos do portal
        if (u.user_metadata?.role === 'client' || u.app_metadata?.role === 'client') {
          return
        }

        const email = u.email?.toLowerCase().trim() || ""
        const isStefano = email === "stefano.remy@gmail.com" || email.includes("stefano")

        const matchedDefault = DEFAULT_COLABORADORES.find(
          (c) => c.email.toLowerCase() === email
        )

        const id = u.app_metadata?.colaborador_id || u.user_metadata?.colaborador_id || matchedDefault?.id || `col-${u.id.slice(0, 8)}`
        const code = matchedDefault?.code || `COL00${index + 1}`
        const name = isStefano
          ? "Stefano"
          : matchedDefault?.name || u.user_metadata?.name || u.user_metadata?.full_name || (email.split("@")[0].toUpperCase())

        const accessLevel = isStefano
          ? "Administrador"
          : u.app_metadata?.access_level || u.user_metadata?.access_level || matchedDefault?.access_level || (u.user_metadata?.role === 'admin' ? "Administrador" : "Operacional")

        const permissions = isStefano
          ? [
              "Acesso Total (Super-Admin)",
              "Gestão de Clientes & Contratos",
              "Emissão e Controlo de Guias CTT",
              "Pedidos de Recolha & Distribuição",
              "Faturação & Contas Correntes",
              "Gestão de Transportadoras & Frotas",
              "Configurações de Webservices & Integrações"
            ]
          : u.app_metadata?.permissions || u.user_metadata?.permissions || matchedDefault?.permissions || ["Acesso Operacional"]

        const colab: Colaborador = {
          id,
          code,
          name,
          role: isStefano
            ? "Super-Admin / Gestão Geral & Sistemas"
            : matchedDefault?.role || u.user_metadata?.role_title || (accessLevel === "Administrador" ? "Administrador de Sistemas" : "Operações & Logística"),
          department: matchedDefault?.department || (isStefano ? "Direção Executiva" : "Operações & Logística"),
          email: u.email || "",
          phone: u.user_metadata?.phone || matchedDefault?.phone || "910000000",
          mobile_phone: u.user_metadata?.phone || matchedDefault?.mobile_phone || "910000000",
          nif: matchedDefault?.nif || "",
          status: "Ativo",
          access_level: accessLevel,
          agency_location: matchedDefault?.agency_location || "Sede - Felgueiras / Guimarães",
          admission_date: matchedDefault?.admission_date || u.created_at?.slice(0, 10) || "2023-01-01",
          avatar_color: matchedDefault?.avatar_color || (isStefano ? "#16a34a" : "#2563eb"),
          avatar: u.user_metadata?.avatar || u.app_metadata?.avatar || matchedDefault?.avatar || undefined,
          permissions,
          emergency_contact: matchedDefault?.emergency_contact || "",
          notes: isStefano
            ? "Super-Administrador com acesso total e irrestrito a todos os módulos do TMS."
            : matchedDefault?.notes || "",
          created_at: u.created_at || new Date().toISOString(),
        }

        colaboradoresMap.set(id, colab)
      })
    }
  } catch (err: any) {
    console.warn("[getColaboradoresAction] Erro ao listar contas do auth:", err?.message)
    DEFAULT_COLABORADORES.forEach((col) => {
      colaboradoresMap.set(col.id, { ...col })
    })
  }

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

  // 3. Ler de audit_log para persistência de alterações recentes de perfil e credenciais
  try {
    const { data: logs } = await supabase
      .from("audit_log")
      .select("*")
      .in("action", ["colaborador_created", "colaborador_updated", "colaborador_deleted", "colaborador_credentials_updated"])
      .order("created_at", { ascending: true })

    if (logs && logs.length > 0) {
      logs.forEach((log: any) => {
        if (log.action === "colaborador_deleted" && log.details?.id) {
          colaboradoresMap.delete(log.details.id)
        } else if (log.action === "colaborador_credentials_updated" && log.details?.colaborador_id) {
          const prev = colaboradoresMap.get(log.details.colaborador_id)
          if (prev) {
            colaboradoresMap.set(log.details.colaborador_id, {
              ...prev,
              access_level: prev.email?.toLowerCase().includes("stefano") ? "Administrador" : (log.details.access_level || prev.access_level),
              permissions: prev.email?.toLowerCase().includes("stefano") ? prev.permissions : (log.details.permissions || prev.permissions),
            })
          }
        } else if (log.details?.id) {
          const prev = (colaboradoresMap.get(log.details.id) || {}) as any
          colaboradoresMap.set(log.details.id, {
            ...prev,
            ...log.details,
            avatar: log.details.avatar || prev.avatar,
          })
        }
      })
    }
  } catch (err: any) {
    console.warn("[getColaboradoresAction] Audit log query warning:", err?.message)
  }

  // Garantir sempre Stefano como Super-Admin inalterável com acesso total
  for (const [id, col] of colaboradoresMap.entries()) {
    if (col.email?.toLowerCase().includes("stefano") || col.name.toLowerCase() === "stefano") {
      col.access_level = "Administrador"
      col.permissions = [
        "Acesso Total (Super-Admin)",
        "Gestão de Clientes & Contratos",
        "Emissão e Controlo de Guias CTT",
        "Pedidos de Recolha & Distribuição",
        "Faturação & Contas Correntes",
        "Gestão de Transportadoras & Frotas",
        "Configurações de Webservices & Integrações"
      ]
      colaboradoresMap.set(id, col)
    }
  }

  return Array.from(colaboradoresMap.values()).sort((a, b) => a.code.localeCompare(b.code))
}

/**
 * Cria ou atualiza um colaborador
 */
export async function saveColaboradorAction(colaboradorData: Partial<Colaborador> & { name: string; role: string; department: string }) {
  await requireEmployee()

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
    avatar: colaboradorData.avatar || undefined,
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
      tenant_id: (await getTenantId()),
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
      tenant_id: (await getTenantId()),
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
  await requireEmployee()

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  try {
    await supabase.from("colaboradores").delete().eq("id", id)
  } catch {}

  try {
    await supabase.from("audit_log").insert({
      tenant_id: (await getTenantId()),
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
  await requireEmployee()

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  try {
    await supabase.from("colaboradores").update({ status, updated_at: now }).eq("id", id)
  } catch {}

  try {
    await supabase.from("audit_log").insert({
      tenant_id: (await getTenantId()),
      action: "colaborador_updated",
      details: { id, status, updated_at: now },
      created_at: now,
    })
  } catch {}

  revalidatePath("/ops/entidades/colaboradores")
  return { success: true }
}
