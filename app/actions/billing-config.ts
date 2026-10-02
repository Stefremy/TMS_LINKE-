"use server"

import { createAdminClient } from "@/lib/supabase/server"
import { MoloniClient } from "@/lib/moloni/moloni-client"
import { requireEmployee, getTenantId } from "@/lib/auth/context"
import { revalidatePath } from "next/cache"

import { type BillingConfig, DEFAULT_BILLING_CONFIG } from "./billing-config-types"


/**
 * Obtém as configurações de faturação do TMS e Moloni
 */
export async function getBillingConfigAction(): Promise<BillingConfig> {
  const supabase = createAdminClient()
  try {
    const { data: logs } = await supabase
      .from("audit_log")
      .select("details")
      .eq("action", "moloni_billing_settings")
      .order("created_at", { ascending: false })
      .limit(1)

    if (logs && logs[0]?.details) {
      return {
        ...DEFAULT_BILLING_CONFIG,
        ...logs[0].details,
      }
    }
  } catch (err) {
    console.error("Erro ao obter configurações de faturação:", err)
  }

  return DEFAULT_BILLING_CONFIG
}

/**
 * Guarda as configurações de faturação
 */
export async function saveBillingConfigAction(config: Partial<BillingConfig>): Promise<{ success: boolean; error?: string }> {
  await requireEmployee()
  const supabase = createAdminClient()
  const tenantId = await getTenantId()

  try {
    const current = await getBillingConfigAction()
    const merged: BillingConfig = {
      ...current,
      ...config,
      articleReference: (config.articleReference || current.articleReference || "LINKE-TMS").trim().toUpperCase(),
      articleDesignation: (config.articleDesignation || current.articleDesignation || "Serviço de Transporte").trim(),
      articleSummary: (config.articleSummary ?? current.articleSummary ?? "").trim(),
    }

    const { error } = await supabase.from("audit_log").insert({
      action: "moloni_billing_settings",
      tenant_id: tenantId || "11111111-1111-1111-1111-111111111111",
      details: merged,
    })

    if (error) throw error

    revalidatePath("/ops/configuracao/faturacao")
    revalidatePath("/ops/faturacao/contas-corrente")
    return { success: true }
  } catch (err: any) {
    console.error("Erro ao guardar configurações de faturação:", err)
    return { success: false, error: err?.message || "Falha ao gravar configurações." }
  }
}

/**
 * Testa e/ou sincroniza o artigo configurado diretamente na conta do Moloni
 */
export async function syncMoloniArticleAction(articleData: {
  reference: string
  name: string
  summary?: string
}): Promise<{ success: boolean; message: string; productId?: number }> {
  await requireEmployee()
  const supabase = createAdminClient()

  try {
    // 1. Obter credenciais do Moloni
    let moloniConfig: any = null
    if (process.env.MOLONI_REFRESH_TOKEN && process.env.MOLONI_COMPANY_ID) {
      moloniConfig = {
        refreshToken: process.env.MOLONI_REFRESH_TOKEN,
        companyId: process.env.MOLONI_COMPANY_ID,
      }
    } else {
      const { data: mLogs } = await supabase
        .from("audit_log")
        .select("details")
        .eq("action", "moloni_connection_config")
        .order("created_at", { ascending: false })
        .limit(1)

      if (mLogs && mLogs[0]?.details?.refresh_token && mLogs[0]?.details?.company_id) {
        moloniConfig = {
          refreshToken: mLogs[0].details.refresh_token,
          companyId: mLogs[0].details.company_id,
        }
      }
    }

    if (!moloniConfig) {
      return { success: false, message: "A conta do Moloni não está conectada." }
    }

    const moloni = new MoloniClient(moloniConfig)
    const taxId = await moloni.getTaxId(23)
    const ref = (articleData.reference || "LINKE-TMS").trim().toUpperCase()
    const name = (articleData.name || "Serviço de Transporte").trim()
    const summary = (articleData.summary || "").trim()

    // Procurar artigo existente
    const products = await moloni.request("products/getAll", { qty: 50, offset: 0 })
    const existing = Array.isArray(products) ? products.find((p: any) => p.reference === ref) : null

    if (existing) {
      // Artigo já existe no Moloni: atualizar designação se necessário
      try {
        await moloni.request("products/update", {
          product_id: existing.product_id,
          name: name,
          summary: summary,
          reference: ref,
          category_id: existing.category_id || 0,
          unit_id: existing.unit_id || 0,
          price: existing.price || 1,
          type: 1,
          has_stock: 0,
          taxes: taxId ? [{ tax_id: taxId, value: 23, order: 1, cumulative: 0 }] : []
        })
        return { 
          success: true, 
          message: `Artigo "${ref}" atualizado no Moloni com sucesso! (ID: ${existing.product_id})`,
          productId: existing.product_id
        }
      } catch (upErr: any) {
        return { 
          success: true, 
          message: `Artigo "${ref}" já existe no catálogo do Moloni (ID: ${existing.product_id}).`,
          productId: existing.product_id
        }
      }
    }

    // Se não existir, criar novo produto limpo
    const productId = await moloni.getGenericProductId(taxId, ref, name, summary)
    return {
      success: true,
      message: `Novo artigo "${ref} - ${name}" criado e verificado no catálogo Moloni com sucesso! (ID: ${productId})`,
      productId,
    }
  } catch (err: any) {
    console.error("Erro na sincronização de artigo Moloni:", err)
    return { success: false, message: err?.message || "Erro de comunicação com o Moloni." }
  }
}

/**
 * Obter status detalhado e opções disponíveis na conta Moloni conectada
 */
export async function getMoloniDetailsAction() {
  await requireEmployee()
  const supabase = createAdminClient()

  try {
    let moloniConfig: any = null
    let companyName = "Empresa Moloni"
    let companyVat = ""

    if (process.env.MOLONI_REFRESH_TOKEN && process.env.MOLONI_COMPANY_ID) {
      moloniConfig = {
        refreshToken: process.env.MOLONI_REFRESH_TOKEN,
        companyId: process.env.MOLONI_COMPANY_ID,
      }
    } else {
      const { data: mLogs } = await supabase
        .from("audit_log")
        .select("details")
        .eq("action", "moloni_connection_config")
        .order("created_at", { ascending: false })
        .limit(1)

      if (mLogs && mLogs[0]?.details?.refresh_token && mLogs[0]?.details?.company_id) {
        moloniConfig = {
          refreshToken: mLogs[0].details.refresh_token,
          companyId: mLogs[0].details.company_id,
        }
        companyName = mLogs[0].details.company_name || companyName
        companyVat = mLogs[0].details.company_vat || companyVat
      }
    }

    if (!moloniConfig) {
      return { isConnected: false }
    }

    const moloni = new MoloniClient(moloniConfig)
    
    // Obter Séries Documentais e Impostos
    let documentSets: any[] = []
    let taxes: any[] = []
    try {
      const sets = await moloni.request("documentSets/getAll", {})
      if (Array.isArray(sets)) {
        documentSets = sets.map((s: any) => ({
          id: s.document_set_id,
          name: s.name,
          active: s.active === 1
        }))
      }
    } catch {}

    try {
      const tList = await moloni.request("taxes/getAll", {})
      if (Array.isArray(tList)) {
        taxes = tList.map((t: any) => ({
          id: t.tax_id,
          name: t.name,
          value: parseFloat(t.value)
        }))
      }
    } catch {}

    return {
      isConnected: true,
      companyId: moloniConfig.companyId,
      companyName,
      companyVat,
      documentSets,
      taxes,
    }
  } catch (err: any) {
    return { isConnected: false, error: err?.message }
  }
}
