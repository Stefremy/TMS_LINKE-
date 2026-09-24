"use server"

import { createAdminClient } from "@/lib/supabase/server"
import { MoloniClient } from "@/lib/moloni/moloni-client"
import { revalidatePath } from "next/cache"
import { getClientesAction } from "@/app/actions/clientes"
import { getShipmentsAction } from "@/app/actions/shipments"
import { getAuthContext, requireEmployee, requireUser, getTenantId } from "@/lib/auth/context"

const isValidUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val))

/**
 * Criação da Fatura no Moloni e registo do Extrato Detalhado no TMS.
 */
export async function emitInvoiceAction(clientId: string, shipmentIds: string[], skipMoloni: boolean = false, groupShipments: boolean = false, isProForma: boolean = false) {
  await requireEmployee()
  try {
    const supabase = createAdminClient()
    
    // 1. Obter Cliente do TMS (com fallback garantido)
    const allClients = await getClientesAction()
    const client = allClients.find((c: any) => c.id === clientId)
      
    if (!client) {
      throw new Error("Cliente não encontrado.")
    }

    // 2. Obter Envios do TMS (Garantir que apanhamos todos os envios, mesmo os que só estão no audit_log)
    const allShipments = await getShipmentsAction()
    const shipments = allShipments.filter((s: any) => shipmentIds.includes(s.id))

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

        // B. Obter dados base do Moloni (Série, Taxa, Artigo Genérico)
        const taxId = await moloni.getTaxId(23)
        const documentSetId = await moloni.getDocumentSet()
        const productId = await moloni.getGenericProductId(taxId)

        // C. Preparar Linhas da Fatura
        let products: any[] = []
        
        if (groupShipments) {
          // Simplificada: Agrupadas por serviço para evitar faturas com muitas páginas
          const groupedShipments: Record<string, { qty: number, basePrice: number, fuelTax: number, specialFees: number }> = {}
          for (const s of shipments) {
            const serviceName = s.service_type || "Transporte / Logística"
            if (!groupedShipments[serviceName]) {
              groupedShipments[serviceName] = { qty: 0, basePrice: 0, fuelTax: 0, specialFees: 0 }
            }
            groupedShipments[serviceName].qty += 1
            
            const hasFuelTax = Number(s.fuel_tax_amount || 0) > 0
            if (hasFuelTax) {
              groupedShipments[serviceName].basePrice += Number(s.base_price || 0)
              groupedShipments[serviceName].fuelTax += Number(s.fuel_tax_amount || 0)
            } else {
              groupedShipments[serviceName].basePrice += Number(s.sell_price || 0) - Number(s.special_fees_amount || 0)
            }
            groupedShipments[serviceName].specialFees += Number(s.special_fees_amount || 0)
          }

          for (const [serviceName, data] of Object.entries(groupedShipments)) {
            if (data.basePrice > 0) {
              products.push({
                productId: productId,
                name: `Serviço ${serviceName} (${data.qty} envios)`,
                summary: `Faturação de envios no período.`,
                qty: 1, 
                price: data.basePrice,
                taxes: [{ tax_id: taxId, value: 23 }]
              })
            }
            if (data.fuelTax > 0) {
              products.push({
                productId: productId,
                name: `Taxa de Combustível (${data.qty} envios)`,
                summary: `Taxa suplementar aplicável ao serviço.`,
                qty: 1,
                price: data.fuelTax,
                taxes: [{ tax_id: taxId, value: 23 }]
              })
            }
            if (data.specialFees > 0) {
              products.push({
                productId: productId,
                name: `Serviços Suplementares (${data.qty} envios)`,
                summary: `Taxas especiais selecionadas aplicadas ao serviço.`,
                qty: 1,
                price: data.specialFees,
                taxes: [{ tax_id: taxId, value: 23 }]
              })
            }
          }
        } else {
          // Completa: Listadas uma a uma
          for (const s of shipments) {
            const serviceName = s.service_type || "Transporte / Logística"
            const trackingBase = s.tracking_number || s.reference || `ENV-${(s.id || "").slice(0, 8).toUpperCase()}`
            const weightStr = s.weight_kg ? ` (Peso: ${s.weight_kg}kg)` : ""
            const summaryText = s.recipient_name ? `Destino: ${s.recipient_name} ${s.recipient_city ? `(${s.recipient_city})` : ''}` : `Faturação de envio.`
            const hasFuelTax = Number(s.fuel_tax_amount || 0) > 0

            const specialFees = Number(s.special_fees_amount || 0)

            if (hasFuelTax) {
              products.push({
                productId: productId,
                name: `Envio ${trackingBase} - ${serviceName}${weightStr}`,
                summary: summaryText,
                qty: 1,
                price: Number(s.base_price || 0),
                taxes: [{ tax_id: taxId, value: 23 }]
              })
              products.push({
                productId: productId,
                name: `Taxa de Combustível - Envio ${trackingBase}`,
                summary: ``,
                qty: 1,
                price: Number(s.fuel_tax_amount || 0),
                taxes: [{ tax_id: taxId, value: 23 }]
              })
            } else {
              products.push({
                productId: productId,
                name: `Envio ${trackingBase} - ${serviceName}${weightStr}`,
                summary: summaryText,
                qty: 1,
                price: Number(s.sell_price || 0) - specialFees,
                taxes: [{ tax_id: taxId, value: 23 }]
              })
            }

            if (specialFees > 0) {
              const desc = s.special_fees_description || "Serviços Especiais"
              products.push({
                productId: productId,
                name: `Taxa Especial (${desc}) - Envio ${trackingBase}`,
                summary: ``,
                qty: 1,
                price: specialFees,
                taxes: [{ tax_id: taxId, value: 23 }]
              })
            }
          }
        }

        const validProducts = products.filter((p: any) => p.price > 0)
        
        if (validProducts.length === 0) {
           throw new Error("Todos os envios selecionados têm valor nulo (0€).")
        }

        const dateNow = new Date().toISOString().split("T")[0]
        const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

        // D. Emitir Fatura ou Fatura Pró-Forma
        let invoiceRes;
        if (isProForma) {
          invoiceRes = await moloni.createProFormaInvoice({
            customerId: moloniCustomerId,
            date: dateNow,
            expirationDate: expirationDate,
            documentSetId: documentSetId,
            products: validProducts
          })
        } else {
          invoiceRes = await moloni.createInvoice({
            customerId: moloniCustomerId,
            date: dateNow,
            expirationDate: expirationDate,
            documentSetId: documentSetId,
            products: validProducts
          })
        }
        
        moloniDocumentId = invoiceRes.document_id
        moloniDocumentUrl = await moloni.getDocumentPDFLink(moloniDocumentId)
      } catch (moloniErr: any) {
        moloniEmissionError = moloniErr?.message || "Erro desconhecido ao comunicar com Moloni"
        console.warn("Moloni Invoice Emission Warning (continuing with TMS statement):", moloniEmissionError)
      }
    } else {
      moloniEmissionError = "Conta Moloni ainda não está ligada."
    }

    // Se Moloni estiver desligado/falhar, criamos na mesma o Extrato Interno mas sem PDFs.
    
    // 3. Criar Registo de Extrato no audit_log (sem necessidade de tabela separada)
    const statementNumber = `EXT-${new Date().getFullYear()}/${String(new Date().getMonth()+1).padStart(2,'0')}-${Math.floor(Math.random() * 9000 + 1000)}`
    const statementId = crypto.randomUUID()
    const tenantId = isValidUuid((client as any).tenant_id) ? (client as any).tenant_id : (await getTenantId())

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

    // 4. Marcar Envios como faturados (guardar referência ao extrato) - Apenas se não for Pró-Forma
    if (!isProForma) {
      try {
        await supabase
          .from('shipments')
          .update({ billing_statement_id: statementId } as any)
          .in('id', shipmentIds)
      } catch {
        console.warn("billing_statement_id column may not exist yet - extrato registado no audit_log")
      }
    }

    revalidatePath("/ops/faturacao/contas-corrente")
    revalidatePath("/app/faturas")
    revalidatePath("/app")
    
    const localMoloniPdfUrl = `/api/statements/${encodeURIComponent(statementNumber)}/moloni-pdf`
    
    return { 
      success: true, 
      statementNumber, 
      url: `/api/statements/${encodeURIComponent(statementNumber)}/pdf`,
      moloniDocumentPdf: moloniDocumentUrl ? localMoloniPdfUrl : null,
      moloniError: moloniEmissionError
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
  const ctx = await requireUser()
  const supabase = createAdminClient()
  
  let targetClientId = clientId
  if (ctx.role === 'client') {
    targetClientId = ctx.client_id || undefined
  }
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

    if (targetClientId) {
      statements = statements.filter((s: any) => s.client_id === targetClientId)
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
  await requireEmployee()
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

    const selectedCompany = companies[0]
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
export async function emitMoloniInvoiceForStatementAction(statementIdOrNumber: string, groupShipments: boolean = false, isProForma: boolean = false) {
  await requireEmployee()
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

    // Se já tiver fatura emitida no Moloni (e NÃO for pró-forma), devolver o link existente
    if (stmt.moloni_document_pdf && !stmt.is_pro_forma) {
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

    // 5. Obter artigos, taxas e série
    const taxId = await moloni.getTaxId(23)
    const documentSetId = await moloni.getDocumentSet()
    const productId = await moloni.getGenericProductId(taxId)

    // 6. Preparar linhas dos envios
    const shipments = stmt.shipments || []
    let products: any[] = []
    
    if (groupShipments) {
      // Simplificada: Agrupadas por serviço
      const groupedShipments: Record<string, { qty: number, basePrice: number, fuelTax: number, specialFees: number }> = {}
      
      for (const s of shipments) {
        const serviceName = s.service_type || "Transporte / Logística"
        if (!groupedShipments[serviceName]) {
          groupedShipments[serviceName] = { qty: 0, basePrice: 0, fuelTax: 0, specialFees: 0 }
        }
        groupedShipments[serviceName].qty += 1
        
        const hasFuelTax = Number(s.fuel_tax_amount || 0) > 0
        if (hasFuelTax) {
          groupedShipments[serviceName].basePrice += Number(s.base_price || 0)
          groupedShipments[serviceName].fuelTax += Number(s.fuel_tax_amount || 0)
        } else {
          groupedShipments[serviceName].basePrice += Number(s.sell_price || 0) - Number(s.special_fees_amount || 0)
        }

        groupedShipments[serviceName].specialFees += Number(s.special_fees_amount || 0)
      }

      for (const [serviceName, data] of Object.entries(groupedShipments)) {
        if (data.basePrice > 0) {
          products.push({
            productId: productId,
            name: `Serviço ${serviceName} (${data.qty} envios)`,
            summary: `Faturação de envios no período.`,
            qty: 1, 
            price: data.basePrice,
            taxes: [{ tax_id: taxId, value: 23 }]
          })
        }
        if (data.fuelTax > 0) {
          products.push({
            productId: productId,
            name: `Taxa de Combustível (${data.qty} envios)`,
            summary: `Taxa suplementar aplicável ao serviço.`,
            qty: 1,
            price: data.fuelTax,
            taxes: [{ tax_id: taxId, value: 23 }]
          })
        }
        if (data.specialFees > 0) {
          products.push({
            productId: productId,
            name: `Serviços Suplementares (${data.qty} envios)`,
            summary: `Taxas especiais selecionadas aplicadas ao serviço.`,
            qty: 1,
            price: data.specialFees,
            taxes: [{ tax_id: taxId, value: 23 }]
          })
        }
      }
    } else {
      // Completa: Listadas uma a uma
      for (const s of shipments) {
        const serviceName = s.service_type || "Transporte / Logística"
        const trackingBase = s.tracking_number || s.reference || `ENV-${(s.id || "").slice(0, 8).toUpperCase()}`
        const weightStr = s.weight_kg ? ` (Peso: ${s.weight_kg}kg)` : ""
        const summaryText = s.recipient_name ? `Destino: ${s.recipient_name} ${s.recipient_city ? `(${s.recipient_city})` : ''}` : `Faturação de envio.`
        const hasFuelTax = Number(s.fuel_tax_amount || 0) > 0

        const specialFees = Number(s.special_fees_amount || 0)

        if (hasFuelTax) {
          products.push({
            productId: productId,
            name: `Envio ${trackingBase} - ${serviceName}${weightStr}`,
            summary: summaryText,
            qty: 1,
            price: Number(s.base_price || 0),
            taxes: [{ tax_id: taxId, value: 23 }]
          })
          products.push({
            productId: productId,
            name: `Taxa de Combustível - Envio ${trackingBase}`,
            summary: ``,
            qty: 1,
            price: Number(s.fuel_tax_amount || 0),
            taxes: [{ tax_id: taxId, value: 23 }]
          })
        } else {
          products.push({
            productId: productId,
            name: `Envio ${trackingBase} - ${serviceName}${weightStr}`,
            summary: summaryText,
            qty: 1,
            price: Number(s.sell_price || 0) - specialFees,
            taxes: [{ tax_id: taxId, value: 23 }]
          })
        }

        if (specialFees > 0) {
          const desc = s.special_fees_description || "Serviços Especiais"
          products.push({
            productId: productId,
            name: `Taxa Especial (${desc}) - Envio ${trackingBase}`,
            summary: ``,
            qty: 1,
            price: specialFees,
            taxes: [{ tax_id: taxId, value: 23 }]
          })
        }
      }
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

    const dateNow = new Date().toISOString().split("T")[0]
    const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

    // 7. Criar fatura/pro-forma no Moloni
    let invoiceRes
    if (isProForma) {
      invoiceRes = await moloni.createProFormaInvoice({
        customerId: moloniCustomerId,
        date: dateNow,
        expirationDate: expirationDate,
        documentSetId: documentSetId,
        products: validProducts
      })
    } else {
      invoiceRes = await moloni.createInvoice({
        customerId: moloniCustomerId,
        date: dateNow,
        expirationDate: expirationDate,
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

    // 8. Atualizar no audit_log
    const updatedDetails = {
      ...stmt,
      moloni_document_id: moloniDocId,
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
        await supabase
          .from('shipments')
          .update({ billing_statement_id: match.id } as any)
          .in('id', stmt.shipment_ids)
      } catch (e) {
        console.warn("Could not update shipments billing_statement_id", e)
      }
    }

    revalidatePath("/ops/faturacao/contas-corrente")
    revalidatePath("/app/faturas")

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
        const documentSetId = await moloni.getDocumentSet()
        const defaultTaxId = await moloni.getTaxId(23)
        const genericProductId = await moloni.getGenericProductId(defaultTaxId)

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

        // 3. Emitir Fatura no Moloni
        const invoiceRes = await moloni.createInvoice({
          customerId: moloniCustomerId,
          date: payload.invoiceDate || new Date().toISOString().split("T")[0],
          expirationDate: payload.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
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
  await requireEmployee()
  try {
    const supabase = createAdminClient()
    const { data: logs, error } = await supabase
      .from('audit_log')
      .select('id, created_at, details')
      .eq('action', 'custom_invoice')
      .order('created_at', { ascending: false })

    if (error || !logs) {
      return []
    }

    return logs.map((log: any) => ({
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
      pdf_url: `/api/custom-invoices/${encodeURIComponent(log.details?.invoice_number || log.details?.id || log.id)}/pdf`,
      created_at: log.created_at
    }))
  } catch (err: any) {
    console.warn("getCustomInvoicesAction error:", err)
    return []
  }
}

/**
 * Emite um Recibo no Moloni para uma fatura existente
 */
export async function emitReceiptAction(statementId: string, clientId: string, moloniDocumentId: number, totalValue: number) {
  await requireEmployee()
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


export async function emitMoloniReceiptForStatementAction(statementId: string) {
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

    if (!moloniConfig) {
      return { success: false, error: "Moloni não está ligado" }
    }
    const moloni = new MoloniClient(moloniConfig)

    // Obter Extrato
    const { data: logs, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('action', 'billing_statement')
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

    const dateNow = new Date().toISOString().split("T")[0]

    // Criar o recibo
    const receiptRes = await moloni.createReceipt({
      customerId: moloniCustomerId,
      date: dateNow,
      documentSetId: documentSetId,
      invoiceId: stmt.moloni_document_id,
      value: Number(stmt.total_value || 0)
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
