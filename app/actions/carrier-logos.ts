"use server"

import fs from "fs"
import path from "path"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEmployee, getTenantId } from "@/lib/auth/context"
import { revalidatePath } from "next/cache"

import { 
  type CarrierConfigItem, 
  type CarrierLogosSettings, 
  DEFAULT_CARRIER_LOGOS_SETTINGS 
} from "./carrier-logos-types"


/**
 * Obtém as configurações de logótipos das transportadoras
 */
export async function getCarrierLogosSettingsAction(): Promise<CarrierLogosSettings> {
  const supabase = createAdminClient()
  try {
    const { data: logs } = await supabase
      .from("audit_log")
      .select("details")
      .eq("action", "carrier_logos_settings")
      .order("created_at", { ascending: false })
      .limit(1)

    if (logs && logs[0]?.details?.carriers) {
      return {
        ...DEFAULT_CARRIER_LOGOS_SETTINGS,
        ...logs[0].details,
      }
    }
  } catch (err) {
    console.error("Erro ao obter configurações de logótipos:", err)
  }

  return DEFAULT_CARRIER_LOGOS_SETTINGS
}

/**
 * Guarda as configurações de logótipos das transportadoras
 */
export async function saveCarrierLogosSettingsAction(settings: CarrierLogosSettings): Promise<{ success: boolean; error?: string }> {
  await requireEmployee()
  const supabase = createAdminClient()
  const tenantId = await getTenantId()

  try {
    const { error } = await supabase.from("audit_log").insert({
      action: "carrier_logos_settings",
      tenant_id: tenantId || "11111111-1111-1111-1111-111111111111",
      details: settings,
    })

    if (error) throw error

    revalidatePath("/ops/configuracao/transportadoras")
    revalidatePath("/ops")
    revalidatePath("/ops/envios")
    return { success: true }
  } catch (err: any) {
    console.error("Erro ao gravar configurações de logótipos:", err)
    return { success: false, error: err?.message || "Falha ao gravar configurações." }
  }
}

/**
 * Faz upload de um novo logótipo e guarda em /public/logo_transportadoras/
 */
export async function uploadCarrierLogoAction(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
  await requireEmployee()

  try {
    const file = formData.get("file") as File | null
    if (!file) {
      return { success: false, error: "Nenhum ficheiro enviado." }
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const rawName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, "_")
    const filename = `${Date.now()}_${rawName}`
    const uploadDir = path.join(process.cwd(), "public", "logo_transportadoras")

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    const filePath = path.join(uploadDir, filename)
    fs.writeFileSync(filePath, buffer)

    const publicUrl = `/logo_transportadoras/${filename}`
    return { success: true, url: publicUrl }
  } catch (err: any) {
    console.error("Erro ao fazer upload do logo:", err)
    return { success: false, error: err?.message || "Falha ao processar ficheiro." }
  }
}

/**
 * Lista todos os ficheiros de imagem disponíveis em /public e /public/logo_transportadoras
 */
export async function getAvailableLogoFilesAction(): Promise<string[]> {
  const results: string[] = []

  try {
    const carrierLogoDir = path.join(process.cwd(), "public", "logo_transportadoras")
    if (fs.existsSync(carrierLogoDir)) {
      const files = fs.readdirSync(carrierLogoDir)
      for (const f of files) {
        if (/\.(svg|png|jpe?g|webp)$/i.test(f)) {
          results.push(`/logo_transportadoras/${f}`)
        }
      }
    }

    const publicDir = path.join(process.cwd(), "public")
    if (fs.existsSync(publicDir)) {
      const pFiles = fs.readdirSync(publicDir)
      for (const f of pFiles) {
        if (/\.(svg|png|jpe?g|webp)$/i.test(f)) {
          results.push(`/${f}`)
        }
      }
    }
  } catch (err) {
    console.warn("Erro ao listar logótipos existentes:", err)
  }

  return Array.from(new Set(results))
}
