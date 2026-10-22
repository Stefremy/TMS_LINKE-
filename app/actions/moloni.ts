"use server"
import {creditInvoicePayment} from "@/lib/billing/credit-notes/products"

import {loadInvoiceCredits, invoiceCreditSummary} from "@/lib/billing/credit-notes/balances"
import { createAdminClient } from "@/lib/supabase/server"
import { MoloniClient } from "@/lib/moloni/moloni-client"
import { revalidatePath } from "next/cache"
import { getClientesAction } from "@/app/actions/clientes"
import { getShipmentsAction } from "@/app/actions/shipments"
import { getAuthContext, requireEmployee, requireUser, getTenantId } from "@/lib/auth/context"
import { getBillingConfigAction } from "@/app/actions/billing-config"
import { paymentDueDays } from "@/lib/billing/payment-terms"
import { addCalendarDays, lisbonDate } from "@/lib/billing/recurring-periods"
import { moloniRedirectUri } from "@/lib/config/public-origins"
import { buildShipmentInvoiceLines } from "@/lib/billing/shipment-invoice-lines"
import { hydrateShipmentCharges } from "@/lib/services/billing/shipment-charge-snapshots"
import { canInvoiceShipment } from "@/lib/billing/shipment-eligibility"
import { SHIPMENT_LIST_COLUMNS } from "@/lib/services/shipments/shipment-fetcher"

const isValidUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val))

async function claimManualInvoiceShipments(clientId: string, shipmentIds: string[]) {
  const ctx = await requireEmployee()
  const { error } = await createAdminClient().rpc('claim_billing_shipments', {
    p_tenant: ctx.tenant_id, p_client: clientId, p_emission: crypto.randomUUID(), p_shipments: shipmentIds,
  })
  if (error) throw new Error('Estes envios já estão faturados ou têm uma emissão em curso/por confirmar. Não repita a emissão.')
}

/**
 * Criação da Fatura no Moloni e registo do Extrato Detalhado no TMS.
 */
export async function internalEmitInvoice(client: any, shipments: any[], skipMoloni: boolean = false, groupShipments: boolean = true, isProForma: boolean = false) {
  const ctx = await requireEmployee()
  const supabase = createAdminClient()
  if (!client?.id || !shipments?.length) throw new Error("Cliente ou envios não encontrados.")
  const persistedClient = (await getClientesAction(client.id)).find((c: any) => c.id === client.id)
  if (!persistedClient) throw new Error("Cliente não encontrado nesta empresa.")
  client = { ...persistedClient, tenant_id: ctx.tenant_id }
  const selectedIds = [...new Set(shipments.map((s: any) => s.id))]
  const { data: authoritativeShipments, error: shipmentError } = await supabase.from('shipments').select(SHIPMENT_LIST_COLUMNS)
    .eq('tenant_id', ctx.tenant_id).eq('client_id', client.id).in('id', selectedIds)
  if (shipmentError || authoritativeShipments?.length !== selectedIds.length) throw new Error("Envios não encontrados neste cliente.")
  if (authoritativeShipments.some((s: { status?: string | null }) => !canInvoiceShipment(s))) {
    throw new Error("A seleção inclui envios cancelados, anulados ou em rascunho. Estes envios não podem ser faturados. Atualize a página e selecione apenas envios válidos.")
  }
  shipments = await hydrateShipmentCharges(supabase, ctx.tenant_id, client.id, authoritativeShipments)

  

    if (!shipments || shipments.length === 0) {
      throw new Error("Envios não encontrados.")
    }

    // Calcular Totais
    const totalValue = shipments.reduce((acc: number, s: any) => acc + Number(s.sell_price || 0), 0)

    let moloniDocumentId = null
    let moloniDocumentUrl = null
    let moloniDocumentNumber: string | null = null
    
    // Verificar credenciais Moloni (no ambiente ou em audit_log)
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

    let moloniEmissionError: string | null = null

    if (moloniConfig && !skipMoloni) {
      try {
        const moloni = new MoloniClient(moloniConfig)
        
        // A. Verificar/Criar Cliente no Moloni
        let moloniCustomerId = null
        if (client.nif) {
          const moloniCust = await moloni.getCustomerByVat(client.nif)
          if (moloniCust) {
            moloniCustomerId = moloniCust.customer_id
            
            // Sync TMS client data to Moloni to ensure address and postal code are correct
            await moloni.updateCustomer(moloniCustomerId, {
              vat: client.nif || "999999990",
              number: moloniCust.number,
              name: client.legal_name || client.short_name || "Cliente Desconhecido",
              address: client.address || "Desconhecida",
              zipCode: client.postal_code || "0000-000",
              city: client.city || "Desconhecida",
              email: client.email,
              phone: client.phone
            }).catch(e => console.warn("Erro ao atualizar cliente Moloni:", e))
          }
        }
        
        if (!moloniCustomerId) {
          moloniCustomerId = await moloni.createCustomer({
            vat: client.nif || "999999990",
            number: `C${Date.now()}`,
            name: client.legal_name || client.short_name || "Cliente Desconhecido",
            address: client.address || "Desconhecida",
            zipCode: client.postal_code || "0000-000",
            city: client.city || "Desconhecida",
            email: client.email,
            phone: client.phone
          })
        }

        // B. Obter dados base do Moloni (Série, Taxa, Artigo Genérico do TMS)
        const billingConfig = await getBillingConfigAction()
        const taxId = await moloni.getTaxId(billingConfig.defaultVatRate || 23)
        const documentSetId = billingConfig.defaultDocumentSetId || (await moloni.getDocumentSet())
        const productId = await moloni.getGenericProductId(
          taxId,
          billingConfig.articleReference,
          billingConfig.articleDesignation,
          billingConfig.articleSummary
        )

        // Separate recorded charges without changing the verified shipment totals.
        const products = buildShipmentInvoiceLines(shipments, {
          ...billingConfig, productId, taxId, vatRate: billingConfig.defaultVatRate || 23,
          grouped: typeof groupShipments === "boolean" ? groupShipments : billingConfig.defaultGrouping === "grouped",
        })

        const validProducts = products.filter((p: any) => p.price > 0)
        
        if (validProducts.length === 0) {
           throw new Error("Todos os envios selecionados têm valor nulo (0€).")
        }

        const dateNow = lisbonDate()
        const paymentDays = paymentDueDays(client.payment_due_days, billingConfig.defaultPaymentDays === undefined ? 30 : billingConfig.defaultPaymentDays)
        const expirationDate = addCalendarDays(dateNow, paymentDays)

        if (!isProForma) await claimManualInvoiceShipments(client.id, shipments.map((s: any) => s.id))

        // D. Emitir Fatura ou Fatura Pró-Forma
        let invoiceRes;
        if (isProForma) {
          invoiceRes = await moloni.createProFormaInvoice({
            customerId: moloniCustomerId,
            date: dateNow,
            expirationDate: expirationDate,
            paymentDays,
            documentSetId: documentSetId,
            products: validProducts
          })
        } else {
          invoiceRes = await moloni.createInvoice({
            customerId: moloniCustomerId,
            date: dateNow,
            expirationDate: expirationDate,
            paymentDays,
            documentSetId: documentSetId,
            products: validProducts
          })
        }
        
        moloniDocumentId = invoiceRes.document_id
        if (!moloniDocumentId) throw new Error("O Moloni não confirmou o número do documento.")
        try {
          moloniDocumentUrl = await moloni.getDocumentPDFLink(moloniDocumentId)
          if (!moloniDocumentUrl) moloniEmissionError = "O PDF ainda não está disponível no Moloni."
        } catch {
          moloniEmissionError = "Não foi possível obter o PDF da fatura no Moloni."
        }
        // Fetch human-readable FT number (e.g. "FT 2025/123")
        if (moloniDocumentId) {
          try { moloniDocumentNumber = await moloni.getDocumentNumber(moloniDocumentId) } catch {}
        }
      } catch (moloniErr: any) {
        moloniEmissionError = moloniErr?.message || "Erro desconhecido ao comunicar com Moloni"
        console.warn("Moloni Invoice Emission Warning (continuing with TMS statement):", moloniEmissionError)
      }
    } else {
      moloniEmissionError = "Conta Moloni ainda não está ligada."
    }

    // An official invoice request must not silently become an internal statement.
    if (!skipMoloni && !moloniDocumentId) {
      return { success: false as const, error: moloniEmissionError || "O Moloni não confirmou a emissão da fatura." }
    }
    
    // 3. Criar Registo de Extrato no audit_log (sem necessidade de tabela separada)
    const statementNumber = `EXT-${new Date().getFullYear()}/${String(new Date().getMonth()+1).padStart(2,'0')}-${Math.floor(Math.random() * 9000 + 1000)}`
    const statementId = crypto.randomUUID()
    const tenantId = isValidUuid((client as any).tenant_id) ? (client as any).tenant_id : "11111111-1111-1111-1111-111111111111"
    const shipmentIds = shipments.map((s: any) => s.id)

    const { error: statementErr } = await supabase.from('audit_log').insert({
      tenant_id: tenantId,
      action: "billing_statement",
      details: {
        id: statementId,
        client_id: client.id,
        client_name: client.short_name || client.legal_name,
        statement_number: statementNumber,
        moloni_document_id: moloniDocumentId,
        moloni_document_number: moloniDocumentNumber,
        moloni_document_pdf: moloniDocumentUrl,
        moloni_error: moloniEmissionError,
        is_pro_forma: isProForma,
        total_value: totalValue,
        shipments_count: shipments.length,
        shipment_ids: shipmentIds,
        shipments: shipments.map((s: any) => ({
          id: s.id,
          tracking_number: s.tracking_number,
          reference: s.reference,
          service_type: s.service_type,
          sell_price: Number(s.sell_price || 0),
          base_price: s.base_price != null ? Number(s.base_price) : undefined,
          fuel_tax_amount: s.fuel_tax_amount != null ? Number(s.fuel_tax_amount) : undefined,
          fuel_rate_pct: s.fuel_rate_pct != null ? Number(s.fuel_rate_pct) : undefined,
          special_fees_amount: s.special_fees_amount != null ? Number(s.special_fees_amount) : undefined,
          special_fees_description: s.special_fees_description || undefined,
          weight_kg: s.weight_kg != null ? Number(s.weight_kg) : undefined,
          created_at: s.created_at,
          recipient_name: s.recipient_name,
          recipient_city: s.recipient_city
        })),
        created_at: new Date().toISOString(),
      }
    })

    if (statementErr) {
      console.error("Erro ao registar extrato no audit_log:", statementErr)
      if (moloniDocumentId) {
        throw new Error(`A fatura Moloni ${moloniDocumentId} foi emitida, mas não foi possível guardar o registo no TMS. Não repita a emissão; confirme o documento no Moloni.`)
      }
      throw new Error("Não foi possível guardar o extrato no TMS.")
    }

    // 4. Marcar Envios como faturados (guardar referência ao extrato) - Apenas se não for Pró-Forma
    if (!isProForma) {
      try {
        await supabase.from('billing_statements').upsert({
          id: statementId,
          tenant_id: tenantId,
          client_id: client.id,
          statement_number: statementNumber,
          moloni_document_id: moloniDocumentId ? String(moloniDocumentId) : null,
          moloni_document_pdf: moloniDocumentUrl || null,
          total_value: totalValue,
          shipments_count: shipments.length,
          created_at: new Date().toISOString()
        }, { onConflict: 'id' })

        await supabase
          .from('shipments')
          .update({ billing_statement_id: statementId } as any)
          .in('id', shipmentIds)
      } catch (e) {
        console.warn("billing_statement_id update error:", e)
      }
    }

    revalidatePath("/ops/faturacao/contas-corrente")
    revalidatePath("/app/[storeSlug]/faturas", "page")
    revalidatePath("/app", "layout")
    
    const localMoloniPdfUrl = `/api/statements/${encodeURIComponent(statementNumber)}/moloni-pdf`
    
    return { 
      success: true as const,
      statementNumber, 
      moloniDocumentId,
      moloniDocumentNumber,
      url: `/api/statements/${encodeURIComponent(statementNumber)}/pdf`,
      moloniDocumentPdf: moloniDocumentUrl ? localMoloniPdfUrl : null,
      rawMoloniUrl: moloniDocumentUrl,
      moloniError: moloniEmissionError
    }


}

/**
 * Consulta histórico de extratos emitidos guardados em audit_log
 */
export async function getBillingStatementsAction(clientId?: string) {
  const ctx = await requireUser()
  const supabase = createAdminClient()
  
  let targetClientId = clientId
  if (ctx.role === 'client') {
    targetClientId = ctx.client_id || undefined
  }
  try {
    let query = supabase
      .from('audit_log')
      .select('id, details, created_at')
      .eq('tenant_id', ctx.tenant_id)
      .eq('action', 'billing_statement')
    if (targetClientId) query = query.eq('details->>client_id', targetClientId)
    const { data, error } = await query.order('created_at', { ascending: false })

    if (error || !data) return []

    let statements = data.map((d: any) => ({
      id: d.details?.id,
      ...d.details,
      audit_id: d.id,
      created_at: d.details?.created_at || d.created_at
    }))

    if (targetClientId) {
      statements = statements.filter((s: any) => s.client_id === targetClientId)
    }

    const notes = await loadInvoiceCredits(supabase, ctx.tenant_id, targetClientId)
    return statements.map((stmt: {id?:string; audit_id?:string; client_id?:string; total_value?:unknown}) => ({...stmt,...invoiceCreditSummary(stmt, 'billing_statement', notes)}))
  } catch (err) {
    console.error("getBillingStatementsAction error:", err)
    return []
  }
}

/**
 * Obtém o estado da ligação ao Moloni
 */
export async function getMoloniConfigAction() {
  await requireEmployee()
  const redirectUri = moloniRedirectUri()
  const supabase = createAdminClient()
  try {
    if (process.env.MOLONI_REFRESH_TOKEN && process.env.MOLONI_COMPANY_ID) {
      return {
        isConnected: true,
        companyId: process.env.MOLONI_COMPANY_ID,
        redirectUri,
        clientId: process.env.MOLONI_CLIENT_ID || "518600300"
      }
    }

    const { data: logs } = await supabase
      .from("audit_log")
      .select("details")
      .eq("action", "moloni_connection_config")
      .order("created_at", { ascending: false })
      .limit(1)

    if (logs && logs[0]?.details?.refresh_token) {
      return {
        isConnected: true,
        companyId: logs[0].details.company_id,
        companyName: logs[0].details.company_name,
        redirectUri,
        clientId: process.env.MOLONI_CLIENT_ID || "518600300"
      }
    }

    return {
      isConnected: false,
      redirectUri,
      clientId: process.env.MOLONI_CLIENT_ID || "518600300"
    }
  } catch {
    return { isConnected: false }
  }
}

/**
 * Conecta ao Moloni através de Utilizador e Password (grant_type=password)
 */
export async function connectMoloniWithPasswordAction(formData: FormData) {
  await requireEmployee()
  try {
    const username = (formData.get("username") as string || "").trim()
    const password = (formData.get("password") as string || "").trim()

    if (!username || !password) {
      return { success: false, error: "Introduza o utilizador/email e password da sua conta Moloni." }
    }

    const { refreshToken, companies } = await MoloniClient.loginWithPassword(username, password)
    
    if (!companies || companies.length === 0) {
      return { success: false, error: "Nenhuma empresa associada encontrada nesta conta Moloni." }
    }

    const selectedCompany = (companies || []).find((c: any) => !c.name?.toLowerCase().includes("demonstração")) || companies[0]
    const companyId = String(selectedCompany.company_id)

    // 1. Guardar em audit_log
    const supabase = createAdminClient()
    await supabase.from("audit_log").insert({
      tenant_id: (await getTenantId()),
      action: "moloni_connection_config",
      details: {
        company_id: companyId,
        company_name: selectedCompany.name,
        company_vat: (selectedCompany as any).vat,
        refresh_token: refreshToken,
        connected_at: new Date().toISOString(),
      },
    })

    // 2. Tentar atualizar .env.local
    try {
      const fs = await import("fs")
      const path = await import("path")
      const envPath = path.join(process.cwd(), ".env.local")
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, "utf8")
        
        if (envContent.includes("MOLONI_REFRESH_TOKEN=")) {
          envContent = envContent.replace(/MOLONI_REFRESH_TOKEN=.*(\r?\n|$)/, `MOLONI_REFRESH_TOKEN=${refreshToken}\n`)
        } else {
          envContent += `\nMOLONI_REFRESH_TOKEN=${refreshToken}\n`
        }

        if (envContent.includes("MOLONI_COMPANY_ID=")) {
          envContent = envContent.replace(/MOLONI_COMPANY_ID=.*(\r?\n|$)/, `MOLONI_COMPANY_ID=${companyId}\n`)
        } else {
          envContent += `MOLONI_COMPANY_ID=${companyId}\n`
        }

        fs.writeFileSync(envPath, envContent, "utf8")
        
        // Ensure running Node process gets updated values immediately
        process.env.MOLONI_REFRESH_TOKEN = refreshToken
        process.env.MOLONI_COMPANY_ID = companyId
      }
    } catch (e: any) {
      console.warn("Could not write to .env.local:", e?.message)
    }

    revalidatePath("/ops/configuracao/faturacao")
    revalidatePath("/ops/faturacao/contas-corrente")

    return {
      success: true,
      companyName: selectedCompany.name,
      companyId: companyId,
    }
  } catch (err: any) {
    console.error("connectMoloniWithPasswordAction error:", err)
    return { success: false, error: err.message || "Erro ao ligar ao Moloni." }
  }
}

/**
 * Emite a fatura oficial no Moloni para um extrato previamente criado
 */
export async function emitMoloniInvoiceForStatementAction(statementIdOrNumber: string, groupShipments: boolean = true, isProForma: boolean = false) {
  const ctx = await requireEmployee()
  try {
    const supabase = createAdminClient()
    
    // 1. Obter Extrato do audit_log
    const { data: logs, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('tenant_id', ctx.tenant_id)
      .eq('action', 'billing_statement')
      .order('created_at', { ascending: false })

    if (error || !logs) throw new Error("Extrato não encontrado.")

    const match = logs.find((l: any) => 
      l.id === statementIdOrNumber || 
      l.details?.id === statementIdOrNumber ||
      l.details?.statement_number === statementIdOrNumber
    )

    if (!match || !match.details) {
      throw new Error("Extrato não encontrado.")
    }

    const stmt = match.details

    // Se já tiver fatura emitida no Moloni (e NÃO for pró-forma), devolver o link existente
    if ((stmt.moloni_document_id || stmt.moloni_document_pdf) && !stmt.is_pro_forma) {
      return {
        success: true,
        moloniDocumentId: stmt.moloni_document_id,
        moloniDocumentPdf: stmt.moloni_document_pdf,
        alreadyEmitted: true
      }
    }

    stmt.shipments = await hydrateShipmentCharges(supabase, ctx.tenant_id, stmt.client_id, stmt.shipments || [])

    // 2. Verificar se o Moloni está configurado
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
      throw new Error("Moloni ainda não está conectado. Clique em 'Ligar Moloni' no topo da página para autenticar.")
    }

    const moloni = new MoloniClient(moloniConfig)

    // 3. Obter dados do cliente
    const allClients = await getClientesAction()
    const client: any = allClients.find((c: any) => c.id === stmt.client_id) || {
      legal_name: stmt.client_name,
      short_name: stmt.client_name,
      nif: "999999990",
      email: "",
      phone: ""
    }

    // 4. Verificar ou Criar cliente no Moloni
    let moloniCustomerId = null
    if (client.nif && client.nif !== "999999990") {
      const moloniCust = await moloni.getCustomerByVat(client.nif)
      if (moloniCust) {
        moloniCustomerId = moloniCust.customer_id

        // Sync TMS client data to Moloni
        await moloni.updateCustomer(moloniCustomerId, {
          vat: client.nif,
          number: moloniCust.number,
          name: client.legal_name || client.short_name || stmt.client_name || "Cliente TMS",
          address: (client as any).address || "Desconhecida",
          zipCode: (client as any).postal_code || "0000-000",
          city: (client as any).city || "Desconhecida",
          email: client.email || (client as any).billing_email || "",
          phone: client.phone || ""
        }).catch(e => console.warn("Erro ao atualizar cliente Moloni:", e))
      }
    }

    if (!moloniCustomerId) {
      moloniCustomerId = await moloni.createCustomer({
        vat: client.nif || "999999990",
        number: `C${Date.now()}`,
        name: client.legal_name || client.short_name || stmt.client_name || "Cliente TMS",
        address: (client as any).address || "Desconhecida",
        zipCode: (client as any).postal_code || "0000-000",
        city: (client as any).city || "Desconhecida",
        email: client.email || (client as any).billing_email || "",
        phone: client.phone || ""
      })
    }

    // 5. Obter artigos, taxas e série (respeitando configurações de faturação do TMS)
    const billingConfig = await getBillingConfigAction()
    const taxId = await moloni.getTaxId(billingConfig.defaultVatRate || 23)
    const documentSetId = billingConfig.defaultDocumentSetId || (await moloni.getDocumentSet())
    const productId = await moloni.getGenericProductId(
      taxId,
      billingConfig.articleReference,
      billingConfig.articleDesignation,
      billingConfig.articleSummary
    )

    // Same separation for a previously saved, not-yet-issued statement.
    const shipments = stmt.shipments || []
    const products = buildShipmentInvoiceLines(shipments, {
      ...billingConfig, productId, taxId, vatRate: billingConfig.defaultVatRate || 23,
      grouped: typeof groupShipments === "boolean" ? groupShipments : billingConfig.defaultGrouping === "grouped",
    })
    if (shipments.length && Math.round(Number(stmt.total_value) * 100) !== products.reduce((n, p) => n + Math.round(p.price * 100), 0)) {
      throw new Error("A discriminação não corresponde ao total do extrato. Confirme os valores antes de faturar.")
    }

    const validProducts = products.filter((p: any) => p.price > 0)
    if (validProducts.length === 0) {
      validProducts.push({
        productId: productId,
        name: `Extrato TMS ${stmt.statement_number} (${stmt.shipments_count || 1} envios)`,
        summary: `Faturação de conta corrente`,
        qty: 1,
        price: Number(stmt.total_value || 1),
        taxes: [{ tax_id: taxId, value: 23 }]
      })
    }

    const dateNow = lisbonDate()
    const paymentDays = paymentDueDays(client.payment_due_days, billingConfig.defaultPaymentDays === undefined ? 30 : billingConfig.defaultPaymentDays)
    const expirationDate = addCalendarDays(dateNow, paymentDays)

    if (!isProForma) await claimManualInvoiceShipments(stmt.client_id, stmt.shipment_ids || stmt.shipments?.map((s: any) => s.id) || [])

    // 7. Criar fatura/pro-forma no Moloni
    let invoiceRes
    if (isProForma) {
      invoiceRes = await moloni.createProFormaInvoice({
        customerId: moloniCustomerId,
        date: dateNow,
        expirationDate: expirationDate,
        paymentDays,
        documentSetId: documentSetId,
        products: validProducts
      })
    } else {
      invoiceRes = await moloni.createInvoice({
        customerId: moloniCustomerId,
        date: dateNow,
        expirationDate: expirationDate,
        paymentDays,
        documentSetId: documentSetId,
        products: validProducts
      })
    }

    const moloniDocId = invoiceRes.document_id

    if (!moloniDocId) {
      throw new Error(`Falha ao emitir. Resposta do Moloni: ${JSON.stringify(invoiceRes)}`)
    }

    let moloniDocPdf = null
    try {
      moloniDocPdf = await moloni.getDocumentPDFLink(moloniDocId)
    } catch (e: any) {
      if (e.message.includes('{"valid":0}')) {
        throw new Error(`Documento emitido (ID: ${moloniDocId}), mas o Moloni recusou gerar o PDF. Verifique se a Pró-Forma ficou em Rascunho.`)
      }
      throw e
    }

    // Fetch human-readable FT number (e.g. "FT 2025/123")
    let moloniDocNumber: string | null = null
    try { moloniDocNumber = await moloni.getDocumentNumber(moloniDocId) } catch {}

    // 8. Atualizar no audit_log
    const updatedDetails = {
      ...stmt,
      moloni_document_id: moloniDocId,
      moloni_document_number: moloniDocNumber || stmt.moloni_document_number || null,
      moloni_document_pdf: moloniDocPdf,
      moloni_receipt_pdf: isProForma ? stmt.moloni_receipt_pdf : moloniDocPdf, // If Fatura-Recibo, it is the receipt
      is_pro_forma: isProForma,
      moloni_proforma_pdf: stmt.is_pro_forma && !isProForma ? stmt.moloni_document_pdf : (isProForma ? moloniDocPdf : stmt.moloni_proforma_pdf),
      moloni_invoiced_at: new Date().toISOString()
    }


    await supabase
      .from('audit_log')
      .update({ details: updatedDetails })
      .eq('id', match.id)

    // Se passou de Pró-Forma para Fatura definitiva, marcamos também na tabela de shipments
    if (stmt.is_pro_forma && stmt.shipment_ids && Array.isArray(stmt.shipment_ids) && stmt.shipment_ids.length > 0) {
      try {
        const stmtId = stmt.id || match.id
        await supabase.from('billing_statements').upsert({
          id: stmtId,
          tenant_id: match.tenant_id || "11111111-1111-1111-1111-111111111111",
          client_id: stmt.client_id,
          statement_number: stmt.statement_number || `EXT-${stmtId.slice(0, 8)}`,
          moloni_document_id: moloniDocId ? String(moloniDocId) : null,
          moloni_document_pdf: moloniDocPdf || null,
          total_value: Number(stmt.total_value || 0),
          shipments_count: Number(stmt.shipments_count || stmt.shipment_ids.length),
          created_at: stmt.created_at || new Date().toISOString()
        }, { onConflict: 'id' })

        await supabase
          .from('shipments')
          .update({ billing_statement_id: stmtId } as any)
          .in('id', stmt.shipment_ids)
      } catch (e) {
        console.warn("Could not update shipments billing_statement_id", e)
      }
    }

    revalidatePath("/ops/faturacao/contas-corrente")
    revalidatePath("/app/[storeSlug]/faturas", "page")

    return {
      success: true,
      moloniDocumentId: moloniDocId,
      moloniDocumentPdf: `/api/statements/${encodeURIComponent(stmt.statement_number || stmt.id)}/moloni-pdf`
    }
  } catch (err: any) {
    console.error("emitMoloniInvoiceForStatementAction error:", err)
    return { success: false, error: err.message || "Erro ao emitir fatura no Moloni" }
  }
}

export interface CustomInvoiceItemInput {
  title: string
  description?: string
  qty: number
  unitPrice: number
  taxRate: number // 23, 13, 6, 0
  discountPct?: number
}

export interface CustomInvoicePayload {
  clientId?: string
  clientName: string
  clientVat?: string
  clientAddress?: string
  clientZip?: string
  clientCity?: string
  clientEmail?: string
  clientPhone?: string
  invoiceDate: string
  dueDate: string
  paymentTerms?: string
  paymentMethod?: string
  notes?: string
  items: CustomInvoiceItemInput[]
}

/**
 * Cria uma fatura personalizada no Moloni (para serviços extras como website, lojas online, consultoria, etc.)
 * e guarda o registo no TMS audit_log.
 */
export async function emitCustomInvoiceAction(payload: CustomInvoicePayload) {
  await requireEmployee()
  try {
    const supabase = createAdminClient()

    if (!payload.clientName || payload.clientName.trim().length === 0) {
      throw new Error("O nome do cliente é obrigatório.")
    }

    if (!payload.items || payload.items.length === 0) {
      throw new Error("Adicione pelo menos um serviço ou produto à fatura.")
    }

    const validItems = payload.items.filter(it => Number(it.unitPrice || 0) > 0 && Number(it.qty || 0) > 0)
    if (validItems.length === 0) {
      throw new Error("Pelo menos um serviço deve ter preço superior a 0,00€.")
    }

    // Cálculos financeiros
    let subtotal = 0
    let totalDiscount = 0
    const taxBreakdown: Record<number, { base: number; tax: number }> = {}

    const calculatedItems = validItems.map(it => {
      const qty = Number(it.qty || 1)
      const unitPrice = Number(it.unitPrice || 0)
      const discountPct = Number(it.discountPct || 0)
      const gross = qty * unitPrice
      const discVal = gross * (discountPct / 100)
      const net = gross - discVal
      const taxRate = Number(it.taxRate !== undefined ? it.taxRate : 23)
      const taxVal = net * (taxRate / 100)

      subtotal += gross
      totalDiscount += discVal

      if (!taxBreakdown[taxRate]) {
        taxBreakdown[taxRate] = { base: 0, tax: 0 }
      }
      taxBreakdown[taxRate].base += net
      taxBreakdown[taxRate].tax += taxVal

      return {
        ...it,
        qty,
        unitPrice,
        discountPct,
        net,
        taxRate,
        taxVal,
        total: net + taxVal
      }
    })

    const totalNet = subtotal - totalDiscount
    let totalTax = 0
    Object.values(taxBreakdown).forEach(t => {
      totalTax += t.tax
    })
    const grandTotal = totalNet + totalTax

    // Gerar número de fatura interno
    const invoiceNumber = `FAT-P-${new Date().getFullYear()}/${String(new Date().getMonth()+1).padStart(2,'0')}-${Math.floor(1000 + Math.random() * 9000)}`
    const invoiceId = crypto.randomUUID()

    let moloniDocumentId: number | null = null
    let moloniDocumentPdf: string | null = null
    let moloniEmissionError: string | null = null

    // Verificar se Moloni está conectado
    let moloniClientConfig: any = null
    if (process.env.MOLONI_REFRESH_TOKEN && process.env.MOLONI_COMPANY_ID) {
      moloniClientConfig = {
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
        moloniClientConfig = {
          refreshToken: mLogs[0].details.refresh_token,
          companyId: mLogs[0].details.company_id,
        }
      }
    }

    if (moloniClientConfig) {
      try {
        const moloni = new MoloniClient({
          companyId: moloniClientConfig.companyId,
          refreshToken: moloniClientConfig.refreshToken
        })

        // 1. Obter ou Criar Cliente no Moloni
        let moloniCustomerId: number | null = null
        const vatToSearch = (payload.clientVat || "").trim()

        if (vatToSearch && vatToSearch !== "999999990") {
          const existingCust = await moloni.getCustomerByVat(vatToSearch)
          if (existingCust?.customer_id) {
            moloniCustomerId = existingCust.customer_id
          }
        }

        if (!moloniCustomerId) {
          moloniCustomerId = await moloni.createCustomer({
            vat: vatToSearch || "999999990",
            number: `CP${Date.now()}`,
            name: payload.clientName,
            address: payload.clientAddress || "Desconhecida",
            zipCode: payload.clientZip || "1000-001",
            city: payload.clientCity || "Portugal",
            email: payload.clientEmail,
            phone: payload.clientPhone
          })
        }

        if (!moloniCustomerId) {
          throw new Error("Não foi possível registar o cliente no Moloni.")
        }

        // 2. Preparar Produtos para o Moloni
        const billingConfig = await getBillingConfigAction()
        const documentSetId = billingConfig.defaultDocumentSetId || (await moloni.getDocumentSet())
        const defaultTaxId = await moloni.getTaxId(billingConfig.defaultVatRate || 23)
        const genericProductId = await moloni.getGenericProductId(
          defaultTaxId,
          billingConfig.articleReference,
          billingConfig.articleDesignation,
          billingConfig.articleSummary
        )

        const moloniProducts = []
        for (const item of calculatedItems) {
          const itemTaxId = await moloni.getTaxId(item.taxRate)
          moloniProducts.push({
            productId: genericProductId,
            name: item.title,
            summary: item.description || "",
            qty: item.qty,
            price: item.unitPrice * (1 - (item.discountPct || 0) / 100),
            taxes: itemTaxId ? [{ tax_id: itemTaxId, value: item.taxRate }] : []
          })
        }

        const customPaymentDays = typeof billingConfig.defaultPaymentDays === "number" ? billingConfig.defaultPaymentDays : 30
        const invoiceRes = await moloni.createInvoice({
          customerId: moloniCustomerId,
          date: payload.invoiceDate || new Date().toISOString().split("T")[0],
          expirationDate: payload.dueDate || new Date(Date.now() + customPaymentDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          documentSetId: documentSetId,
          products: moloniProducts
        })

        moloniDocumentId = invoiceRes.document_id
        if (moloniDocumentId) {
          moloniDocumentPdf = await moloni.getDocumentPDFLink(moloniDocumentId)
        }
      } catch (mErr: any) {
        moloniEmissionError = mErr?.message || "Erro de comunicação com Moloni"
        console.warn("Moloni Custom Invoice Emission Warning:", moloniEmissionError)
      }
    } else {
      moloniEmissionError = "Conta Moloni ainda não está ligada."
    }

    // 4. Guardar no audit_log do Supabase
    const invoiceDetails = {
      id: invoiceId,
      invoice_number: invoiceNumber,
      client_id: payload.clientId || null,
      client_name: payload.clientName,
      client_vat: payload.clientVat || "Consumidor Final",
      client_address: payload.clientAddress || "",
      client_zip: payload.clientZip || "",
      client_city: payload.clientCity || "Portugal",
      client_email: payload.clientEmail || "",
      client_phone: payload.clientPhone || "",
      invoice_date: payload.invoiceDate,
      due_date: payload.dueDate,
      payment_terms: payload.paymentTerms || "Pronto Pagamento",
      payment_method: payload.paymentMethod || "Transferência Bancária",
      notes: payload.notes || "",
      items: calculatedItems,
      subtotal,
      total_discount: totalDiscount,
      total_net: totalNet,
      tax_breakdown: taxBreakdown,
      total_tax: totalTax,
      total_value: grandTotal,
      moloni_document_id: moloniDocumentId,
      moloni_document_pdf: moloniDocumentPdf,
      moloni_error: moloniEmissionError,
      created_at: new Date().toISOString()
    }

    const { error: dbErr } = await supabase.from('audit_log').insert({
      tenant_id: (await getTenantId()),
      action: "custom_invoice",
      details: invoiceDetails
    })

    if (dbErr) {
      console.error("Error saving custom invoice to audit_log:", dbErr)
    }

    revalidatePath("/ops/faturacao/personalizada")
    revalidatePath("/ops/faturacao/contas-corrente")

    return {
      success: true,
      id: invoiceId,
      invoiceNumber,
      totalValue: grandTotal,
      moloniDocumentId,
      moloniDocumentPdf,
      pdfUrl: `/api/custom-invoices/${encodeURIComponent(invoiceNumber)}/pdf`,
      moloniError: moloniEmissionError
    }
  } catch (err: any) {
    console.error("emitCustomInvoiceAction error:", err)
    return {
      success: false,
      error: err.message || "Erro ao emitir fatura personalizada"
    }
  }
}

/**
 * Obtém a lista de faturas personalizadas emitidas anteriormente
 */
export async function getCustomInvoicesAction() {
  const ctx = await requireEmployee()
  try {
    const supabase = createAdminClient()
    const { data: logs, error } = await supabase
      .from('audit_log')
      .select('id, created_at, details')
      .eq('tenant_id', ctx.tenant_id)
      .eq('action', 'custom_invoice')
      .order('created_at', { ascending: false })

    if (error || !logs) {
      return []
    }

    const creditNotes = await loadInvoiceCredits(supabase, ctx.tenant_id)
    const mapInvoice = (log: any) => ({
      audit_id: log.id,
      client_id: log.details?.client_id,
      id: log.details?.id || log.id,
      invoice_number: log.details?.invoice_number || `FAT-${log.id.slice(0, 8)}`,
      client_name: log.details?.client_name || "Cliente Desconhecido",
      client_vat: log.details?.client_vat || "",
      invoice_date: log.details?.invoice_date || log.created_at?.split("T")[0],
      due_date: log.details?.due_date,
      payment_terms: log.details?.payment_terms,
      total_value: Number(log.details?.total_value || 0),
      items_count: Array.isArray(log.details?.items) ? log.details.items.length : 1,
      items: log.details?.items || [],
      moloni_document_id: log.details?.moloni_document_id || null,
      moloni_document_pdf: log.details?.moloni_document_pdf || null,
      moloni_receipt_id: log.details?.moloni_receipt_id || null,
      moloni_receipt_pdf: log.details?.moloni_receipt_pdf || null,
      status: log.details?.status || null,
      pdf_url: `/api/custom-invoices/${encodeURIComponent(log.details?.invoice_number || log.details?.id || log.id)}/pdf`,
      created_at: log.created_at
    })
    return logs.map(mapInvoice).map((invoice: ReturnType<typeof mapInvoice>) => ({...invoice,...invoiceCreditSummary(invoice, "custom_invoice", creditNotes)}))
  } catch (err: any) {
    console.warn("getCustomInvoicesAction error:", err)
    return []
  }
}

/**
 * Emite um Recibo no Moloni para uma fatura existente
 */
export async function emitReceiptAction(statementId: string, clientId: string, moloniDocumentId: number, totalValue: number) {
  const ctx = await requireEmployee()
  try {
    const supabase = createAdminClient()
    
    const allClients = await getClientesAction()
    const client = allClients.find((c: any) => c.id === clientId)
      
    if (!client) throw new Error("Cliente não encontrado no TMS.")

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
      throw new Error("Conta Moloni não está ligada.")
    }

    const moloni = new MoloniClient(moloniConfig)
    
    let moloniCustomerId = null
    if (client.nif) {
      const moloniCust = await moloni.getCustomerByVat(client.nif)
      if (moloniCust) moloniCustomerId = moloniCust.customer_id
    }
    
    if (!moloniCustomerId) {
      throw new Error("Cliente não encontrado no Moloni para emitir o recibo.")
    }

    const creditNotes = (await loadInvoiceCredits(supabase, ctx.tenant_id, clientId)).filter(n => n.invoice_document_id === Number(moloniDocumentId))
    if (creditNotes.some(n => !['issued','cancelled'].includes(n.state))) throw new Error('Confirme ou cancele a nota de crédito em curso antes de emitir recibo.')
    if (creditNotes.some(n => n.state === 'issued')) {
      if (creditNotes.some(n => n.company_id !== String(moloniConfig.companyId))) throw new Error('Confirme a empresa Moloni associada à nota de crédito antes de emitir recibo.')
      const fiscal = await moloni.request('documents/getOne', {document_id:Number(moloniDocumentId)})
      const payment = creditInvoicePayment(fiscal, String(moloniConfig.companyId), Number(moloniDocumentId))
      totalValue = payment.value
      moloniCustomerId = payment.customerId
    }
    const documentSetId = await moloni.getDocumentSet()

    const dateNow = new Date().toISOString().split("T")[0]

    const receiptRes = await moloni.createReceipt({
      customerId: moloniCustomerId,
      documentSetId: documentSetId,
      date: dateNow,
      invoiceId: moloniDocumentId,
      value: totalValue
    })

    console.log("Moloni receiptRes:", receiptRes);

    if (!receiptRes || !receiptRes.document_id) {
        throw new Error(`O recibo foi criado ou ocorreu um erro, mas não foi devolvido o ID do documento. Resposta: ${JSON.stringify(receiptRes)}`);
    }

    const receiptId = receiptRes.document_id
    const receiptPdfUrl = await moloni.getDocumentPDFLink(receiptId)

    // Save to audit_log
    const { data: logs } = await supabase.from('audit_log').select('*').eq('id', statementId).single()
    if (logs && logs.details) {
      const newDetails = {
        ...logs.details,
        moloni_receipt_id: receiptId,
        moloni_receipt_pdf: receiptPdfUrl
      }
      await supabase.from('audit_log').update({ details: newDetails }).eq('id', statementId)
    }

    return { success: true, receiptId, receiptPdfUrl }
  } catch (err: any) {
    console.error("emitReceiptAction error:", err)
    return { success: false, error: err.message || "Erro desconhecido ao emitir o recibo" }
  }
}


export async function getMoloniPaymentMethodsAction() {
  await requireEmployee()
  try {
    const supabase = createAdminClient()
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
    if (!moloniConfig) return { success: false, methods: [] }
    const moloni = new MoloniClient(moloniConfig)
    const methods = await moloni.getPaymentMethods()
    return { success: true, methods }
  } catch (err: any) {
    console.error("getMoloniPaymentMethodsAction error:", err)
    return { success: false, methods: [] }
  }
}

export async function emitMoloniReceiptForStatementAction(
  statementId: string,
  opts?: { date?: string; paymentMethodId?: number; notes?: string }
) {
  const ctx = await requireEmployee()
  try {
    const supabase = createAdminClient()

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
        .eq("tenant_id", ctx.tenant_id)
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
      return { success: false, error: "Moloni não está ligado" }
    }
    const moloni = new MoloniClient(moloniConfig)

    // Obter Extrato
    const { data: logs, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('action', 'billing_statement')
      .eq('tenant_id', ctx.tenant_id)
      .order('created_at', { ascending: false })

    if (error || !logs) throw new Error("Extrato não encontrado.")

    const match = logs.find((l: any) => 
      l.id === statementId || 
      l.details?.id === statementId ||
      l.details?.statement_number === statementId
    )

    if (!match || !match.details) {
      throw new Error("Extrato não encontrado.")
    }

    const stmt = match.details

    if (!stmt.moloni_document_id) {
      return { success: false, error: "Extrato ainda não foi faturado no Moloni (Fatura em falta)." }
    }
    if (stmt.moloni_receipt_pdf) {
      return { success: false, error: "Este extrato já tem um recibo emitido." }
    }

    const creditNotes = (await loadInvoiceCredits(supabase, ctx.tenant_id, stmt.client_id)).filter(n => n.invoice_document_id === Number(stmt.moloni_document_id))
    if (creditNotes.some(n => !['issued','cancelled'].includes(n.state))) throw new Error('Confirme ou cancele a nota de crédito em curso antes de emitir recibo.')
    const hasIssuedCredit = creditNotes.some(n => n.state === 'issued')
    const documentSetId = await moloni.getDocumentSet()
    
    // Obter cliente
    const allClients = await getClientesAction()
    const client: any = allClients.find((c: any) => c.id === stmt.client_id) || {
      legal_name: stmt.client_name,
      short_name: stmt.client_name,
      nif: "999999990"
    }

    // Verificar ou Criar cliente no Moloni
    let moloniCustomerId = null
    if (!hasIssuedCredit && client.nif && client.nif !== "999999990") {
      const moloniCust = await moloni.getCustomerByVat(client.nif)
      if (moloniCust) {
        moloniCustomerId = moloniCust.customer_id
      }
    }

    if (!hasIssuedCredit && !moloniCustomerId) {
      moloniCustomerId = await moloni.createCustomer({
        vat: client.nif || "999999990",
        number: `C${Date.now()}`,
        name: client.legal_name || client.short_name || stmt.client_name || "Cliente TMS",
        address: (client as any).address || "Desconhecida",
        zipCode: (client as any).postal_code || "0000-000",
        city: (client as any).city || "Desconhecida",
        email: client.email || (client as any).billing_email || "",
        phone: client.phone || ""
      })
    }

    const dateNow = opts?.date || new Date().toISOString().split("T")[0]

    let receiptValue = Number(stmt.total_value || 0)
    if (hasIssuedCredit) {
      if (creditNotes.some(n => n.company_id !== String(moloniConfig.companyId))) throw new Error('Confirme a empresa Moloni associada à nota de crédito antes de emitir recibo.')
      const fiscal = await moloni.request('documents/getOne', {document_id:Number(stmt.moloni_document_id)})
      const payment = creditInvoicePayment(fiscal, String(moloniConfig.companyId), Number(stmt.moloni_document_id))
      receiptValue = payment.value
      moloniCustomerId = payment.customerId
    } else if (stmt.period_statement_id) {
      const fiscalDocument = await moloni.request('documents/getOne', { document_id: Number(stmt.moloni_document_id) })
      const { automaticInvoicePayment } = await import('@/lib/billing/recurring-invoices')
      const payment = automaticInvoicePayment(fiscalDocument, Number(stmt.moloni_document_id))
      receiptValue = payment.value
      moloniCustomerId = payment.customerId
    }

    // Criar o recibo
    const receiptRes = await moloni.createReceipt({
      customerId: moloniCustomerId,
      date: dateNow,
      documentSetId: documentSetId,
      invoiceId: stmt.moloni_document_id,
      value: receiptValue,
      paymentMethodId: opts?.paymentMethodId,
      notes: opts?.notes,
    })

    const moloniReceiptId = receiptRes.document_id

    if (!moloniReceiptId) {
      throw new Error(`Falha ao emitir recibo. Resposta do Moloni: ${JSON.stringify(receiptRes)}`)
    }

    let moloniReceiptPdf = null
    try {
      moloniReceiptPdf = await moloni.getDocumentPDFLink(moloniReceiptId)
    } catch (e: any) {
      console.warn("Nao foi possivel obter PDF do recibo", e)
    }

    stmt.moloni_receipt_id = moloniReceiptId
    stmt.moloni_receipt_pdf = moloniReceiptPdf || ""
    stmt.status = "paid"

    const { error: updateErr } = await supabase
      .from('audit_log')
      .update({ details: stmt })
      .eq('id', match.id)
      .eq('tenant_id', ctx.tenant_id)

    if (updateErr) {
      console.warn("Erro ao atualizar o statement no audit_log", updateErr)
    }

    revalidatePath("/ops/faturacao/contas-corrente")

    return { success: true, moloniReceiptPdf }
  } catch (err: any) {
    console.error("emitMoloniReceiptForStatementAction error:", err)
    return { success: false, error: err.message || "Erro ao emitir recibo no Moloni" }
  }
}

/**
 * Emite a Guia de Transporte Oficial (GT) no Moloni para um envio do Ops
 */
export async function emitMoloniWaybillForShipmentAction(shipmentId: string, notes?: string) {
  await requireEmployee()
  try {
    const supabase = createAdminClient()

    // 1. Obter envio
    const { data: dbShipments } = await supabase
      .from("shipments")
      .select("*")
      .or(`id.eq.${shipmentId},tracking_number.eq.${shipmentId}`)
      .limit(1)

    const shipment = dbShipments?.[0]
    if (!shipment) {
      throw new Error("Envio não encontrado no sistema.")
    }

    // 2. Obter Cliente do TMS
    let client: any = null
    if (shipment.client_id) {
      const allClients = await getClientesAction(shipment.client_id)
      client = allClients[0]
    }

    // 3. Obter Configuração Moloni
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
      throw new Error("A conta Moloni não está configurada ou conectada. Vá a Faturação > Gerir Conta Moloni para autorizar.")
    }

    const moloni = new MoloniClient(moloniConfig)

    // 4. Obter ou Criar Cliente no Moloni
    let moloniCustomerId = null
    const clientVat = client?.nif || "999999990"
    const clientName = shipment.recipient_name || client?.legal_name || client?.short_name || "Cliente Final"
    
    if (client?.nif) {
      const moloniCust = await moloni.getCustomerByVat(client.nif).catch(() => null)
      if (moloniCust) {
        moloniCustomerId = moloniCust.customer_id
      }
    }

    if (!moloniCustomerId) {
      moloniCustomerId = await moloni.createCustomer({
        vat: clientVat,
        number: `C${Date.now()}`,
        name: clientName,
        address: shipment.recipient_address || client?.address || "Desconhecida",
        zipCode: shipment.recipient_zip4 ? `${shipment.recipient_zip4}-${shipment.recipient_zip3 || "001"}` : (client?.postal_code || "1000-001"),
        city: client?.city || "Portugal",
        email: client?.email,
        phone: client?.phone,
      })
    }

    // 5. Obter Série e Artigo
    const billingConfig = await getBillingConfigAction()
    const taxId = await moloni.getTaxId(billingConfig.defaultVatRate || 23)
    // Séries para Faturas e Guias de Transporte podem ser diferentes (AT requirements)
    // Usamos sempre uma série certificada para transporte
    let documentSetId = await moloni.getTransportDocumentSet();
    const productId = await moloni.getGenericProductId(
      taxId,
      "CONSUMIVEIS",
      "Material e Consumíveis de Embalagem",
      "Consumíveis operacionais expedidos via TMS"
    )

    const dateNow = new Date().toISOString().split("T")[0]

    // 6. Criar a Guia de Transporte (Bills of Lading)
    const waybillRes = await moloni.createBillOfLading({
      customerId: moloniCustomerId,
      date: dateNow,
      documentSetId: documentSetId,
      notes: notes || `Expedição ${shipment.tracking_number || ""} · AWB: ${shipment.carrier_tracking_number || ""}`,
      deliveryDepartureAddress: shipment.sender_address || "Sede GO Linke",
      deliveryDepartureZip: shipment.sender_zip4 ? `${shipment.sender_zip4}-${shipment.sender_zip3 || "001"}` : "4000-001",
      deliveryDepartureCity: "Portugal",
      deliveryDestinationAddress: shipment.recipient_address || "Morada Destinatário",
      deliveryDestinationZip: shipment.recipient_zip4 ? `${shipment.recipient_zip4}-${shipment.recipient_zip3 || "001"}` : "1000-001",
      deliveryDestinationCity: "Portugal",
      products: [
        {
          productId: productId,
          name: "Material e Consumíveis de Embalagem",
          summary: `Envio operacional ${shipment.tracking_number} (${shipment.service_type || "CTT"})`,
          qty: 1,
          price: Number(shipment.sell_price || 0),
          exemptionReason: "M00",
          taxes: [{ tax_id: taxId, value: 23 }]
        }
      ]
    })

    const moloniDocId = waybillRes?.document_id
    if (!moloniDocId) {
      throw new Error(`Falha ao emitir Guia no Moloni: ${JSON.stringify(waybillRes)}`)
    }

    let moloniDocNum: string | null = null
    let moloniPdfUrl: string | null = null
    try {
      moloniDocNum = await moloni.getDocumentNumber(moloniDocId)
      moloniPdfUrl = await moloni.getDocumentPDFLink(moloniDocId)
    } catch {}

    // 7. Registar no audit_log
    const tenantId = await getTenantId()
    const userCtx = await getAuthContext()
    await supabase.from("audit_log").insert({
      tenant_id: tenantId,
      user_id: userCtx?.user?.id,
      action: "moloni_waybill_created",
      entity_type: "shipment",
      entity_id: shipment.id,
      details: {
        moloni_document_id: moloniDocId,
        moloni_document_number: moloniDocNum,
        moloni_document_pdf: moloniPdfUrl,
        tracking_number: shipment.tracking_number,
        carrier_tracking_number: shipment.carrier_tracking_number,
        created_at: new Date().toISOString(),
      }
    })

    revalidatePath("/ops/envios")

    return {
      success: true,
      documentId: moloniDocId,
      documentNumber: moloniDocNum || `GT ${new Date().getFullYear()}/${moloniDocId}`,
      pdfUrl: moloniPdfUrl,
    }
  } catch (err: any) {
    console.error("emitMoloniWaybillForShipmentAction error:", err)
    return {
      success: false,
      error: err.message || "Erro ao emitir Guia de Transporte no Moloni"
    }
  }
}



/**
 * Criação da Fatura no Moloni (Action para ser chamada a partir da UI)
 */
export async function emitInvoiceAction(clientId: string, shipmentIds: string[], skipMoloni: boolean = false, groupShipments: boolean = true, isProForma: boolean = false) {
  const ctx = await requireEmployee()
  try {
    const supabase = createAdminClient()
    
    // 1. Obter Cliente do TMS
    const allClients = await getClientesAction(clientId)
    const client = allClients[0]
      
    if (!client) {
      throw new Error("Cliente não encontrado.")
    }

    // 2. Obter Envios do TMS
    if (!shipmentIds.length || shipmentIds.some(id => !isValidUuid(id))) {
      throw new Error("Selecione envios válidos para faturar.")
    }
    const ids = [...new Set(shipmentIds)]
    const { data: dbShipments, error } = await supabase.from("shipments").select(SHIPMENT_LIST_COLUMNS)
      .eq("tenant_id", ctx.tenant_id).eq("client_id", clientId).in("id", ids)
    if (error || dbShipments?.length !== ids.length) throw new Error("Não foi possível validar os envios deste cliente.")
    const shipments = dbShipments || []
    const { data: existing, error: existingError } = await supabase.from("audit_log")
      .select("details").eq("tenant_id", ctx.tenant_id).eq("action", "billing_statement")
      .eq("details->>client_id", clientId)
    if (existingError) throw new Error("Não foi possível verificar as faturas existentes. Tente novamente mais tarde.")
    if (existing?.some(({details: stmt}: {details: any}) => stmt.moloni_document_id && !stmt.is_pro_forma &&
      stmt.shipment_ids?.some((id: string) => ids.includes(id)))) {
      throw new Error("Um dos envios já tem fatura Moloni. Atualize a página antes de continuar.")
    }

    return await internalEmitInvoice(client, shipments, skipMoloni, groupShipments, isProForma)
  } catch (err: any) {
    console.error("Emit Invoice Error:", err)
    return { success: false as const, error: err?.message || "Failed to emit invoice" }
  }
}

/**
 * Envia ou Reenvia a Fatura e o Extrato por Email ao Cliente com anexos PDF
 */
export async function sendStatementInvoiceEmailAction(params: {
  statementIdOrNumber: string
  recipientEmail?: string
  includeMoloniPdf?: boolean
  includeStatementPdf?: boolean
}) {
  await requireEmployee()
  try {
    const supabase = createAdminClient()
    const { statementIdOrNumber, recipientEmail, includeMoloniPdf = true, includeStatementPdf = true } = params

    // 1. Procurar extrato em audit_log
    const { data: logs, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('action', 'billing_statement')
      .order('created_at', { ascending: false })

    if (error || !logs || logs.length === 0) {
      throw new Error("Extrato não encontrado.")
    }

    const match = logs.find((l: any) => 
      l.id === statementIdOrNumber || 
      l.details?.id === statementIdOrNumber ||
      l.details?.statement_number === statementIdOrNumber
    )

    if (!match || !match.details) {
      throw new Error("Extrato não encontrado.")
    }

    const stmt = match.details

    // 2. Procurar cliente para obter nome e email padrão
    const allClients = await getClientesAction()
    const client: any = allClients.find((c: any) => c.id === stmt.client_id)

    const targetEmail = (recipientEmail || client?.billing_email || client?.email || "").trim()

    if (!targetEmail || !targetEmail.includes("@")) {
      throw new Error("Endereço de email do destinatário não configurado ou inválido.")
    }

    const clientName = client?.legal_name || client?.short_name || stmt.client_name || "Estimado Cliente"
    const ftNumber = stmt.moloni_document_number 
      ? (String(stmt.moloni_document_number).includes("/") ? stmt.moloni_document_number : `FT ${new Date().getFullYear()}/${stmt.moloni_document_number}`)
      : null
    const docTitle = ftNumber || stmt.statement_number
    const totalStr = Number(stmt.total_value || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const shipmentsCount = stmt.shipments_count || stmt.shipments?.length || 0

    // 3. Preparar anexos PDF
    const attachments: Array<{ filename: string; content: Buffer }> = []

    // A. Fatura Moloni (se emitida)
    if (includeMoloniPdf && (stmt.moloni_document_pdf || stmt.moloni_document_id)) {
      let pdfUrl = stmt.moloni_document_pdf
      if (pdfUrl && pdfUrl.includes("/downloads/?h=") && stmt.moloni_document_id) {
        pdfUrl = pdfUrl.replace("/downloads/?h=", "/downloads/index.php?action=getDownload&h=") + `&d=${stmt.moloni_document_id}&e=&i=1`
      }
      if (!pdfUrl && stmt.moloni_document_id) {
        let moloniConfig: any = null
        if (process.env.MOLONI_REFRESH_TOKEN && process.env.MOLONI_COMPANY_ID) {
          moloniConfig = {
            refreshToken: process.env.MOLONI_REFRESH_TOKEN,
            companyId: process.env.MOLONI_COMPANY_ID,
          }
        }
        if (moloniConfig) {
          try {
            const moloni = new MoloniClient(moloniConfig)
            pdfUrl = await moloni.getDocumentPDFLink(Number(stmt.moloni_document_id))
          } catch {}
        }
      }

      if (pdfUrl) {
        try {
          const res = await fetch(pdfUrl, { cache: "no-store" })
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer())
            attachments.push({
              filename: `Fatura_Oficial_${docTitle.replace(/[\/\\]/g, "_")}.pdf`,
              content: buf,
            })
          }
        } catch (fetchErr) {
          console.warn("Could not download Moloni PDF attachment:", fetchErr)
        }
      }
    }

    // B. Extrato TMS Interno
    if (includeStatementPdf) {
      try {
        const { generateStatementPdfBuffer } = await import("@/lib/services/billing/statement-pdf")
        
        let enrichedShipments = stmt.shipments || []
        const shipmentIds = (stmt.shipment_ids || enrichedShipments.map((s: any) => s.id)).filter(Boolean)
        if (shipmentIds.length > 0) {
          const { data: dbShipments } = await supabase
            .from("shipments")
            .select("id, tracking_number, service_type, recipient_name, recipient_city, recipient_address, sell_price, created_at")
            .in("id", shipmentIds)
          
          if (dbShipments && dbShipments.length > 0) {
            enrichedShipments = enrichedShipments.map((s: any) => {
              const dbS = dbShipments.find((d: any) => d.id === s.id)
              return {
                ...s,
                tracking_number: s.tracking_number || dbS?.tracking_number,
                service_type: s.service_type || dbS?.service_type,
                recipient_name: s.recipient_name || dbS?.recipient_name,
                recipient_city: s.recipient_city || dbS?.recipient_city,
                recipient_address: s.recipient_address || dbS?.recipient_address,
                sell_price: s.sell_price != null ? Number(s.sell_price) : (dbS?.sell_price != null ? Number(dbS.sell_price) : 0),
                base_price: s.base_price,
                fuel_tax_amount: s.fuel_tax_amount,
                special_fees_amount: s.special_fees_amount,
                special_fees_description: s.special_fees_description,
                weight_kg: s.weight_kg,
                created_at: s.created_at || dbS?.created_at
              }
            })
          }
        }

        const pdfData = {
          statementNumber: stmt.statement_number,
          clientName: clientName,
          clientNif: client?.nif || "",
          clientAddress: client?.address || "",
          clientCity: client?.city || "",
          clientEmail: targetEmail,
          dateStr: new Date(stmt.created_at || Date.now()).toLocaleDateString("pt-PT"),
          totalValue: Number(stmt.total_value || 0),
          shipments: enrichedShipments
        }
        const stmtBuf = await generateStatementPdfBuffer(pdfData)
        if (stmtBuf) {
          attachments.push({
            filename: `Extrato_TMS_${stmt.statement_number.replace(/[\/\\]/g, "_")}.pdf`,
            content: stmtBuf,
          })
        }
      } catch (pdfErr) {
        console.warn("Could not generate statement PDF attachment:", pdfErr)
      }
    }

    // 4. HTML Branded Template
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 30px 15px; color: #1e293b; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #0f172a; padding: 24px 32px; text-align: left; border-bottom: 3px solid #16a34a; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { color: #94a3b8; margin: 4px 0 0; font-size: 13px; }
    .body { padding: 32px; }
    .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #0f172a; }
    .intro { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
    .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px; }
    .note { font-size: 12px; color: #64748b; line-height: 1.5; margin-top: 20px; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 32px; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Linke TMS • Faturação</h1>
      <p>Documento de Faturação de Serviços Logísticos</p>
    </div>
    <div class="body">
      <div class="greeting">Olá, ${clientName}</div>
      <div class="intro">
        Encontra-se disponível a fatura relativa aos serviços de logística e transporte prestados. Os respetivos documentos oficiais encontram-se em anexo em formato PDF.
      </div>
      <div class="summary-box">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr style="border-bottom: 1px solid #edf2f7;">
            <td style="padding: 6px 0; color: #64748b;">Documento:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0f172a;">${docTitle}</td>
          </tr>
          <tr style="border-bottom: 1px solid #edf2f7;">
            <td style="padding: 6px 0; color: #64748b;">Nº Extrato TMS:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #0f172a;">${stmt.statement_number}</td>
          </tr>
          <tr style="border-bottom: 1px solid #edf2f7;">
            <td style="padding: 6px 0; color: #64748b;">Envios Faturados:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #0f172a;">${shipmentsCount} envio(s)</td>
          </tr>
          <tr>
            <td style="padding: 10px 0 0; font-size: 15px; font-weight: 700; color: #16a34a;">Valor Total:</td>
            <td style="padding: 10px 0 0; text-align: right; font-size: 16px; font-weight: 800; color: #16a34a;">${totalStr} €</td>
          </tr>
        </table>
      </div>
      <div class="note">
        Os ficheiros PDF da <strong>Fatura Oficial Certificada (AT)</strong> e do <strong>Extrato Detalhado</strong> encontram-se anexados a esta mensagem.
      </div>
    </div>
    <div class="footer">
      Linke Distribuição & Logística • Suporte: geral@linke.pt<br/>
      Este é um email automático de faturação.
    </div>
  </div>
</body>
</html>
`

    // 5. Enviar via Resend
    const { sendEmail } = await import("@/lib/email/resend")
    const sendResult = await sendEmail({
      to: targetEmail,
      subject: `Linke | Fatura de Envios ${docTitle}`,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    })

    if (!sendResult.success) {
      throw new Error(`Falha no envio de email: ${JSON.stringify(sendResult.error)}`)
    }

    // 6. Registar em audit_log
    const tenantId = await getTenantId().catch(() => null)
    await supabase.from("audit_log").insert({
      tenant_id: tenantId,
      action: "billing_invoice_email_sent",
      details: {
        statement_number: stmt.statement_number,
        moloni_document_number: stmt.moloni_document_number,
        recipient_email: targetEmail,
        attachments_count: attachments.length,
        sent_at: new Date().toISOString(),
      }
    })

    return { 
      success: true, 
      recipient: targetEmail,
      attachmentsCount: attachments.length,
      message: `Fatura enviada com sucesso para ${targetEmail}` 
    }
  } catch (err: any) {
    console.error("sendStatementInvoiceEmailAction error:", err)
    return { success: false, error: err?.message || "Erro desconhecido ao enviar fatura por email" }
  }
}

