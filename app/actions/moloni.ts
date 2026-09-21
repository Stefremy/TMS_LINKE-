"use server"

import { createAdminClient } from "@/lib/supabase/server"
import { MoloniClient } from "@/lib/moloni/moloni-client"
import { revalidatePath } from "next/cache"

/**
 * Criação da Fatura no Moloni e registo do Extrato Detalhado no TMS.
 */
export async function emitInvoiceAction(clientId: string, shipmentIds: string[]) {
  try {
    const supabase = createAdminClient()
    
    // 1. Obter Cliente do TMS (guardado em audit_log com action = "client_data")
    const { data: clientLogs } = await supabase
      .from('audit_log')
      .select('details')
      .eq('action', 'client_data')

    const client = clientLogs?.map((l: any) => l.details).find((d: any) => d?.id === clientId)
      
    if (!client) {
      throw new Error("Cliente não encontrado.")
    }

    // 2. Obter Envios do TMS
    const { data: shipments, error: shipmentsErr } = await supabase
      .from('shipments')
      .select('*')
      .in('id', shipmentIds)
      
    if (shipmentsErr || !shipments || shipments.length === 0) {
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

    const { error: statementErr } = await supabase.from('audit_log').insert({
      tenant_id: client.tenant_id || "linke",
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
        created_at: new Date().toISOString(),
      }
    })

    if (statementErr) {
      console.error("Erro ao registar extrato no audit_log:", statementErr)
      throw new Error("Erro ao criar registo de extrato.")
    }

    // 4. Marcar Envios como faturados (guardar referência ao extrato)
    // Tentar atualizar a coluna billing_statement_id se existir, senão apenas logar
    try {
      await supabase
        .from('shipments')
        .update({ billing_statement_id: statementId } as any)
        .in('id', shipmentIds)
    } catch {
      // Se a coluna não existir, ainda assim o extrato ficou registado no audit_log
      console.warn("billing_statement_id column may not exist yet - extrato registado no audit_log")
    }

    revalidatePath("/ops/faturacao/contas-corrente")
    
    return { 
      success: true, 
      statementNumber, 
      url: moloniDocumentUrl 
    }

  } catch (error: any) {
    console.error("emitInvoiceAction error:", error)
    return { success: false, error: error.message }
  }
}
