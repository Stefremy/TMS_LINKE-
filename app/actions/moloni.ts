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
    
    if (process.env.MOLONI_CLIENT_ID) {
      const moloni = new MoloniClient()
      
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
      url: statementPdfUrl 
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
