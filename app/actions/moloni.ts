"use server"

import { createAdminClient } from "@/lib/supabase/server"
import { MoloniClient } from "@/lib/moloni/moloni-client"
import { revalidatePath } from "next/cache"
import { getClientesAction } from "@/app/actions/clientes"
import { getShipmentsAction } from "@/app/actions/shipments"

const LINKE_TENANT_ID = "11111111-1111-1111-1111-111111111111"
const isValidUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val))

/**
 * Criação da Fatura no Moloni e registo do Extrato Detalhado no TMS.
 */
export async function emitInvoiceAction(clientId: string, shipmentIds: string[]) {
  try {
    const supabase = createAdminClient()
    
    // 1. Obter Cliente do TMS (com fallback garantido)
    const allClients = await getClientesAction()
    const client = allClients.find((c: any) => c.id === clientId)
      
    if (!client) {
      throw new Error("Cliente não encontrado.")
    }

    // 2. Obter Envios do TMS
    let shipments: any[] = []
    const { data: dbShipments, error: shipmentsErr } = await supabase
      .from('shipments')
      .select('*')
      .in('id', shipmentIds)
      
    if (!shipmentsErr && dbShipments && dbShipments.length > 0) {
      shipments = dbShipments
    } else {
      const allShipments = await getShipmentsAction()
      shipments = allShipments.filter((s: any) => shipmentIds.includes(s.id))
    }

    if (!shipments || shipments.length === 0) {
      throw new Error("Envios não encontrados.")
    }

    // Calcular Totais
    const totalValue = shipments.reduce((acc: number, s: any) => acc + Number(s.sell_price || 0), 0)

    let moloniDocumentId = null
    let moloniDocumentUrl = null
    
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

    if (moloniConfig) {
      try {
        const moloni = new MoloniClient(moloniConfig)
        
        // A. Verificar/Criar Cliente no Moloni
        let moloniCustomerId = null
        if (client.nif) {
          const moloniCust = await moloni.getCustomerByVat(client.nif)
          if (moloniCust) {
            moloniCustomerId = moloniCust.customer_id
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

        // B. Obter dados base do Moloni (Série, Taxa, Artigo Genérico)
        const taxId = await moloni.getTaxId(23)
        const documentSetId = await moloni.getDocumentSet()
        const productId = await moloni.getGenericProductId(taxId)

        // C. Preparar Linhas da Fatura (Uma linha por envio para ser transparente)
        const products = shipments.map((s: any) => {
          return {
            productId: productId,
            name: `Envio TMS - ${s.tracking_number || s.reference}`,
            summary: `De: ${s.sender_zip4 || ''}-${s.sender_zip3 || ''} Para: ${s.recipient_zip4 || ''}-${s.recipient_zip3 || ''}`,
            qty: 1,
            price: Number(s.sell_price || 0), // Preço s/ IVA
            taxes: [{ tax_id: taxId, value: 23 }]
          }
        })

        const validProducts = products.filter((p: any) => p.price > 0)
        
        if (validProducts.length === 0) {
           throw new Error("Todos os envios selecionados têm valor nulo (0€).")
        }

        const dateNow = new Date().toISOString().split("T")[0]
        const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

        // D. Emitir Fatura
        const invoiceRes = await moloni.createInvoice({
          customerId: moloniCustomerId,
          date: dateNow,
          expirationDate: expirationDate,
          documentSetId: documentSetId,
          products: validProducts
        })
        
        moloniDocumentId = invoiceRes.document_id
        moloniDocumentUrl = await moloni.getDocumentPDFLink(moloniDocumentId)
      } catch (moloniErr: any) {
        console.warn("Moloni Invoice Emission Warning (continuing with TMS statement):", moloniErr?.message)
      }
    }

    // Se Moloni estiver desligado/falhar, criamos na mesma o Extrato Interno mas sem PDFs.
    
    // 3. Criar Registo de Extrato no audit_log (sem necessidade de tabela separada)
    const statementNumber = `EXT-${new Date().getFullYear()}/${String(new Date().getMonth()+1).padStart(2,'0')}-${Math.floor(Math.random() * 9000 + 1000)}`
    const statementId = crypto.randomUUID()
    const tenantId = isValidUuid((client as any).tenant_id) ? (client as any).tenant_id : LINKE_TENANT_ID

    const { error: statementErr } = await supabase.from('audit_log').insert({
      tenant_id: tenantId,
      action: "billing_statement",
      details: {
        id: statementId,
        client_id: client.id,
        client_name: client.short_name || client.legal_name,
        statement_number: statementNumber,
        moloni_document_id: moloniDocumentId,
        moloni_document_pdf: moloniDocumentUrl,
        total_value: totalValue,
        shipments_count: shipments.length,
        shipment_ids: shipmentIds,
        shipments: shipments.map((s: any) => ({
          id: s.id,
          tracking_number: s.tracking_number,
          reference: s.reference,
          sell_price: Number(s.sell_price || 0),
          created_at: s.created_at,
          recipient_name: s.recipient_name,
          recipient_city: s.recipient_city
        })),
        created_at: new Date().toISOString(),
      }
    })

    if (statementErr) {
      console.error("Erro ao registar extrato no audit_log:", statementErr)
      throw new Error(`Erro ao criar registo de extrato: ${statementErr.message || JSON.stringify(statementErr)}`)
    }

    // 4. Marcar Envios como faturados (guardar referência ao extrato)
    try {
      await supabase
        .from('shipments')
        .update({ billing_statement_id: statementId } as any)
        .in('id', shipmentIds)
    } catch {
      console.warn("billing_statement_id column may not exist yet - extrato registado no audit_log")
    }

    revalidatePath("/ops/faturacao/contas-corrente")
    revalidatePath("/app/faturas")
    revalidatePath("/app")
    
    const statementPdfUrl = moloniDocumentUrl || `/api/statements/${encodeURIComponent(statementNumber)}/pdf`
    
    return { 
      success: true, 
      statementNumber, 
      url: statementPdfUrl,
      moloniDocumentPdf: moloniDocumentUrl || null
    }

  } catch (error: any) {
    console.error("emitInvoiceAction error:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Consulta histórico de extratos emitidos guardados em audit_log
 */
export async function getBillingStatementsAction(clientId?: string) {
  const supabase = createAdminClient()
  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select('details, created_at')
      .eq('action', 'billing_statement')
      .order('created_at', { ascending: false })

    if (error || !data) return []

    let statements = data.map((d: any) => ({
      id: d.details?.id,
      ...d.details,
      created_at: d.details?.created_at || d.created_at
    }))

    if (clientId) {
      statements = statements.filter((s: any) => s.client_id === clientId)
    }

    return statements
  } catch (err) {
    console.error("getBillingStatementsAction error:", err)
    return []
  }
}

/**
 * Obtém o estado da ligação ao Moloni
 */
export async function getMoloniConfigAction() {
  const supabase = createAdminClient()
  try {
    if (process.env.MOLONI_REFRESH_TOKEN && process.env.MOLONI_COMPANY_ID) {
      return {
        isConnected: true,
        companyId: process.env.MOLONI_COMPANY_ID,
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
        clientId: process.env.MOLONI_CLIENT_ID || "518600300"
      }
    }

    return {
      isConnected: false,
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

    const selectedCompany = companies[0]
    const companyId = String(selectedCompany.company_id)

    // 1. Guardar em audit_log
    const supabase = createAdminClient()
    await supabase.from("audit_log").insert({
      tenant_id: LINKE_TENANT_ID,
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
      }
    } catch (e: any) {
      console.warn("Could not write to .env.local:", e?.message)
    }

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
export async function emitMoloniInvoiceForStatementAction(statementIdOrNumber: string) {
  try {
    const supabase = createAdminClient()
    
    // 1. Obter Extrato do audit_log
    const { data: logs, error } = await supabase
      .from('audit_log')
      .select('*')
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

    // Se já tiver fatura emitida no Moloni, devolver o link existente
    if (stmt.moloni_document_pdf) {
      return {
        success: true,
        moloniDocumentId: stmt.moloni_document_id,
        moloniDocumentPdf: stmt.moloni_document_pdf,
        alreadyEmitted: true
      }
    }

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

    // 5. Obter artigos, taxas e série
    const taxId = await moloni.getTaxId(23)
    const documentSetId = await moloni.getDocumentSet()
    const productId = await moloni.getGenericProductId(taxId)

    // 6. Preparar linhas dos envios
    const shipments = stmt.shipments || []
    const products = shipments.map((s: any) => ({
      productId: productId,
      name: `Envio TMS - ${s.tracking_number || s.reference || 'Objeto'}`,
      summary: s.recipient_name ? `Destino: ${s.recipient_name} (${s.recipient_city || 'PT'})` : "",
      qty: 1,
      price: Number(s.sell_price || 0),
      taxes: [{ tax_id: taxId, value: 23 }]
    }))

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

    const dateNow = new Date().toISOString().split("T")[0]
    const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

    // 7. Criar fatura no Moloni
    const invoiceRes = await moloni.createInvoice({
      customerId: moloniCustomerId,
      date: dateNow,
      expirationDate: expirationDate,
      documentSetId: documentSetId,
      products: validProducts
    })

    const moloniDocId = invoiceRes.document_id
    const moloniDocPdf = await moloni.getDocumentPDFLink(moloniDocId)

    // 8. Atualizar no audit_log
    const updatedDetails = {
      ...stmt,
      moloni_document_id: moloniDocId,
      moloni_document_pdf: moloniDocPdf,
      moloni_invoiced_at: new Date().toISOString()
    }

    await supabase
      .from('audit_log')
      .update({ details: updatedDetails })
      .eq('id', match.id)

    revalidatePath("/ops/faturacao/contas-corrente")
    revalidatePath("/app/faturas")

    return {
      success: true,
      moloniDocumentId: moloniDocId,
      moloniDocumentPdf: moloniDocPdf
    }
  } catch (err: any) {
    console.error("emitMoloniInvoiceForStatementAction error:", err)
    return { success: false, error: err.message || "Erro ao emitir fatura no Moloni" }
  }
}
