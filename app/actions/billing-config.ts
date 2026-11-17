"use server"
import { errorMessage } from "@/lib/errors"


import { createAdminClient } from "@/lib/supabase/server"
import { billingConfigForEnvironment, getActiveMoloniClient, getActiveMoloniEnvironment, getMoloniConnection, moloniClientFor, type MoloniEnvironment } from "@/lib/moloni/connection"
import { requireEmployee, getTenantId } from "@/lib/auth/context"
import { revalidatePath } from "next/cache"

import { type BillingConfig, DEFAULT_BILLING_CONFIG } from "./billing-config-types"


type StoredBillingSettings = Partial<BillingConfig> & { documentSetIdByEnvironment?: Partial<Record<MoloniEnvironment, number | null>> }

async function loadStoredBillingSettings(tenantId: string): Promise<StoredBillingSettings> {
  const { data, error } = await createAdminClient().from("audit_log").select("details")
    .eq("tenant_id", tenantId).eq("action", "moloni_billing_settings")
    .order("created_at", { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return (data?.details || {}) as StoredBillingSettings
}

/**
 * Obtém as configurações de faturação do TMS e Moloni.
 * A série documental é da empresa Moloni do ambiente ativo (Teste ou Produção).
 */
export async function getBillingConfigAction(): Promise<BillingConfig> {
  try {
    const tenantId = await getTenantId()
    const [stored, environment] = await Promise.all([
      loadStoredBillingSettings(tenantId),
      getActiveMoloniEnvironment(createAdminClient(), tenantId),
    ])
    const { documentSetIdByEnvironment: _byEnv, ...config } = billingConfigForEnvironment({ ...DEFAULT_BILLING_CONFIG, ...stored }, environment) as StoredBillingSettings & BillingConfig
    return config
  } catch (err) {
    console.error("Erro ao obter configurações de faturação:", err)
  }

  return DEFAULT_BILLING_CONFIG
}

/**
 * Guarda as configurações de faturação
 */
export async function saveBillingConfigAction(config: Partial<BillingConfig>): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireEmployee("Faturação & Contas Correntes")
  const supabase = createAdminClient()

  try {
    const environment = await getActiveMoloniEnvironment(supabase, ctx.tenant_id)
    const stored = await loadStoredBillingSettings(ctx.tenant_id)
    const current = await getBillingConfigAction()
    const merged: BillingConfig = {
      ...current,
      ...config,
      articleReference: (config.articleReference || current.articleReference || "LINKE-TMS").trim().toUpperCase(),
      articleDesignation: (config.articleDesignation || current.articleDesignation || "Serviço de Transporte").trim(),
      articleSummary: (config.articleSummary ?? current.articleSummary ?? "").trim(),
    }
    // The document set belongs to one Moloni company: keep one per environment.
    const byEnv = { test: stored.documentSetIdByEnvironment?.test ?? stored.defaultDocumentSetId ?? null,
      ...stored.documentSetIdByEnvironment, [environment]: merged.defaultDocumentSetId ?? null }

    const { error } = await supabase.from("audit_log").insert({
      action: "moloni_billing_settings",
      tenant_id: ctx.tenant_id,
      details: { ...merged, defaultDocumentSetId: byEnv.test ?? null, documentSetIdByEnvironment: byEnv },
    })

    if (error) throw error

    revalidatePath("/ops/configuracao/faturacao")
    revalidatePath("/ops/faturacao/contas-corrente")
    return { success: true }
  } catch (err) {
    console.error("Erro ao guardar configurações de faturação:", err)
    return { success: false, error: errorMessage(err) || "Falha ao gravar configurações." }
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
  await requireEmployee("Faturação & Contas Correntes")
  const supabase = createAdminClient()

  try {
    // 1. Ligação Moloni do ambiente ativo
    const active = await getActiveMoloniClient(supabase, await getTenantId())
    if (!active) {
      return { success: false, message: "A conta do Moloni não está conectada." }
    }
    const { moloni } = active
    const taxId = await moloni.getTaxId(23)
    const ref = (articleData.reference || "LINKE-TMS").trim().toUpperCase()
    const name = (articleData.name || "Serviço de Transporte").trim()
    const summary = (articleData.summary || "").trim()

    // Procurar artigo existente
    const products = await moloni.request("products/getAll", { qty: 50, offset: 0 })
    const existing = Array.isArray(products) ? products.find((p) => p.reference === ref) : null

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
      } catch (upErr) {
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
  } catch (err) {
    console.error("Erro na sincronização de artigo Moloni:", err)
    return { success: false, message: errorMessage(err) || "Erro de comunicação com o Moloni." }
  }
}

/**
 * Obter status detalhado e opções disponíveis na conta Moloni conectada
 */
export async function getMoloniDetailsAction() {
  await requireEmployee("Faturação & Contas Correntes")
  const supabase = createAdminClient()

  try {
    const tenantId = await getTenantId()
    const environment = await getActiveMoloniEnvironment(supabase, tenantId)
    const connection = await getMoloniConnection(supabase, tenantId, environment)
    if (!connection) {
      return { isConnected: false, environment }
    }
    const companyName = connection.companyName || "Empresa Moloni"
    const companyVat = connection.companyVat || ""
    const moloni = moloniClientFor(connection, tenantId)

    // Obter Séries Documentais e Impostos
    let documentSets: {id:number; name:string; active:boolean}[] = []
    let taxes: {id:number; name:string; value:number}[] = []
    try {
      const sets = await moloni.request("documentSets/getAll", {})
      if (Array.isArray(sets)) {
        documentSets = sets.map((s) => ({
          id: s.document_set_id,
          name: s.name,
          active: s.active === 1
        }))
      }
    } catch {}

    try {
      const tList = await moloni.request("taxes/getAll", {})
      if (Array.isArray(tList)) {
        taxes = tList.map((t) => ({
          id: t.tax_id,
          name: t.name,
          value: parseFloat(t.value)
        }))
      }
    } catch {}

    return {
      isConnected: true,
      environment,
      companyId: connection.companyId,
      companyName,
      companyVat,
      documentSets,
      taxes,
    }
  } catch (err) {
    return { isConnected: false, error: errorMessage(err) }
  }
}
