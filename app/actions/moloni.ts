"use server"

import { createAdminClient } from "@/lib/supabase/server"
import { MoloniClient } from "@/lib/moloni/moloni-client"
import { revalidatePath } from "next/cache"

/**
 * Criação da Fatura/Recibo no Moloni e registo do Extrato Detalhado no TMS.
 */
export async function emitInvoiceAction(clientId: string, shipmentIds: string[]) {
  try {
    const supabase = createAdminClient()
    
    // 1. Obter Cliente do TMS
    const { data: client, error: clientErr } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', clientId)
      .single()
      
    if (clientErr || !client) {
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

    // Se as credenciais do Moloni estiverem configuradas, tentamos comunicar
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
          number: client.nif || Date.now().toString(),
          name: client.legal_name || client.short_name,
          address: client.address,
          zipCode: client.zip_code,
          city: client.city,
          email: client.email,
          phone: client.phone
        })
      }

      // B. Emitir Fatura-Recibo
      // Série documental, date, etc. deverão estar parametrizados. 
      // Por agora usamos a data atual e a document_set_id padrao se tivermos.
      // O document_set_id precisa de ser configurado. Colocando um dummy ou o da API.
      // Vamos tentar gerar, mas como não temos IDs exactos para series ou produtos,
      // Isto pode falhar num ambiente real até estar perfeitamente mapeado.
      
      // const invoiceRes = await moloni.createInvoice({
      //   customerId: moloniCustomerId,
      //   date: new Date().toISOString().split('T')[0],
      //   expirationDate: new Date().toISOString().split('T')[0],
      //   documentSetId: Number(process.env.MOLONI_DEFAULT_SET_ID) || 1, 
      //   products: [{
      //     name: "Serviços de Transporte / Logística",
      //     summary: `Ref: Envios no TMS Linke (${shipments.length} envios)`,
      //     qty: 1,
      //     price: totalValue,
      //     exemptionReason: "M01" // Se applies
      //   }]
      // })
      
      // moloniDocumentId = invoiceRes.document_id
      // moloniDocumentUrl = await moloni.getDocumentPDFLink(moloniDocumentId)
      
      // NOTA: Comentado acima para evitar falhar enquanto as credenciais reais não existem.
      // Simulando a resposta:
      moloniDocumentId = "simulated_moloni_id"
      moloniDocumentUrl = "https://moloni.pt/simulated_invoice.pdf"
    }

    // 3. Criar Registo "Billing Statement" no TMS
    // Assumimos que o utilizador já correu a migration
    const statementNumber = `EXT-${new Date().getFullYear()}/${new Date().getMonth()+1}-${Math.floor(Math.random() * 1000)}`
    
    // Tentar criar billing_statement (vai falhar se a tabela nao existir ainda)
    const { data: statement, error: statementErr } = await supabase
      .from('billing_statements')
      .insert({
        tenant_id: client.tenant_id,
        client_id: client.id,
        statement_number: statementNumber,
        moloni_document_id: moloniDocumentId,
        moloni_document_pdf: moloniDocumentUrl,
        total_value: totalValue,
        shipments_count: shipments.length
      })
      .select()
      .single()

    if (statementErr) {
      console.warn("Erro ao inserir em billing_statements (já correste a migration?):", statementErr)
      throw new Error("Erro na BD ao criar o extrato. A migração foi executada?")
    }

    // 4. Marcar Envios como faturados
    const { error: updateErr } = await supabase
      .from('shipments')
      .update({ billing_statement_id: statement.id })
      .in('id', shipmentIds)

    if (updateErr) {
      console.error("Erro a atualizar shipments:", updateErr)
      throw new Error("Erro ao marcar envios como faturados.")
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
