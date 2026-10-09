import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail, compileTemplate } from "@/lib/email/resend"
import { internalEmitInvoice } from "@/app/actions/moloni"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const supabase = createAdminClient()
    const results = []
    const debugLogs: string[] = []
    
    // Parse force flag from URL
    const { searchParams } = new URL(request.url)
    const force = searchParams.get("force") === "true"

    // 1. Fetch clients from audit_log (since full schema is stored there)
    const { data: clientLogs } = await supabase
      .from("audit_log")
      .select("details")
      .eq("action", "client_data")

    const allClients = clientLogs?.map((l: any) => l.details).filter(Boolean) || []
    const clients = allClients.filter((c: any) => c.billing_type === "conta_corrente")

    if (clients.length === 0) return NextResponse.json({ success: true, message: "No clients found." })

    // 2. Fetch email template for billing
    const { data: dbTemplate } = await supabase
      .from("email_templates")
      .select("html_content")
      .eq("id", "billing_statement")
      .single()

    let htmlTemplate = dbTemplate?.html_content
    if (!htmlTemplate) {
      // Default fallback template
      htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Extrato de Faturação - Linke</h2>
        <p>Olá {{client_name}},</p>
        <p>Abaixo encontra o resumo dos envios do seu último ciclo de faturação.</p>
        <br/>
        {{shipments_table}}
        <br/>
        <h3 style="color: #16a34a;">Total a Pagar: {{total_value}}€</h3>
        <p>Para consultar detalhes, aceda à sua área reservada.</p>
      </body>
      </html>
      `
      // Save it so user can edit later
      await supabase.from("email_templates").upsert({
        id: "billing_statement",
        name: "Extrato de Faturação (Conta Corrente)",
        description: "Enviado no final do ciclo de faturação com a lista de envios.",
        html_content: htmlTemplate
      })
    }

    // 3. Process each client
    for (const client of clients) {
      const termsMatch = client.payment_terms?.match(/(\d+)/)
      const cycleDays = termsMatch ? parseInt(termsMatch[1]) : 30 // default 30 days if not found

      // Get last statement
      const { data: lastStmt } = await supabase
        .from("audit_log")
        .select("created_at")
        .eq("action", "billing_statement")
        .filter("details->>client_id", "eq", client.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      let shouldBill = false
      if (!lastStmt || force) {
        shouldBill = true // Never billed or forced
      } else {
        const daysSinceLast = Math.floor((Date.now() - new Date(lastStmt.created_at).getTime()) / (1000 * 60 * 60 * 24))
        if (daysSinceLast >= cycleDays) {
          shouldBill = true
        }
      }

      if (shouldBill) {
        // Fetch unbilled shipments
        const { data: allStmts } = await supabase
          .from("audit_log")
          .select("details")
          .eq("action", "billing_statement")
          .filter("details->>client_id", "eq", client.id)

        const billedIds = new Set<string>()
        allStmts?.forEach((stmt: any) => {
          if (Array.isArray(stmt.details?.shipment_ids)) {
            stmt.details.shipment_ids.forEach((id: string) => billedIds.add(id))
          }
        })

        const { data: shipments, error: shipErr } = await supabase
          .from("shipments")
          .select("id, tracking_number, created_at, recipient_name, recipient_address, sell_price")
          .eq("client_id", client.id)
          .order("created_at", { ascending: true })

        if (shipErr) {
          console.error("Error fetching shipments:", shipErr)
          debugLogs.push(`Error fetching shipments for ${client.id}: ${shipErr.message}`)
        }

        const unbilledShipments = shipments?.filter((s: any) => !billedIds.has(s.id)) || []
        const logMsg = `[CRON] Client ${client.name || client.short_name}: fetched ${shipments?.length} shipments, ${unbilledShipments.length} unbilled.`
        console.log(logMsg)
        debugLogs.push(logMsg)

        if (unbilledShipments.length > 0) {
          let total = 0
          let tableRows = ""

          unbilledShipments.forEach((s: any) => {
            const price = Number(s.sell_price || 0)
            total += price
            const date = new Date(s.created_at).toLocaleDateString("pt-PT")
            tableRows += `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${s.tracking_number}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${date}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${s.recipient_address || s.recipient_name}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${price.toFixed(2)}€</td>
              </tr>
            `
          })

          const tableHtml = `
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
              <thead>
                <tr style="background-color: #f8fafc;">
                  <th style="padding: 8px; border-bottom: 2px solid #ddd;">Envio</th>
                  <th style="padding: 8px; border-bottom: 2px solid #ddd;">Data</th>
                  <th style="padding: 8px; border-bottom: 2px solid #ddd;">Destino</th>
                  <th style="padding: 8px; border-bottom: 2px solid #ddd; text-align: right;">Valor</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          `

          // Emit Invoice via Moloni (Pro-forma if you want, or actual invoice)
          // The user requested: "usa mesmo os envios Stefano Pereira e emite fatura anexada com o email"
          // So we emit an actual invoice, isProForma = false
          const invoiceRes = await internalEmitInvoice(client, unbilledShipments, false, false, false)

          let pdfAttachment = null
          if (invoiceRes.success && invoiceRes.rawMoloniUrl) {
            try {
              const pdfRes = await fetch(invoiceRes.rawMoloniUrl)
              const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
              pdfAttachment = {
                filename: `Fatura_${invoiceRes.moloniDocumentNumber || invoiceRes.statementNumber}.pdf`,
                content: pdfBuffer,
              }
            } catch (pdfErr) {
              console.error("Failed to fetch Moloni PDF for attachment:", pdfErr)
              debugLogs.push(`Failed to fetch Moloni PDF for ${client.id}`)
            }
          }

          // Generate HTML Email
          const emailHtml = compileTemplate(htmlTemplate, {
            client_name: client.name || client.short_name,
            shipments_table: tableHtml,
            total_value: total.toFixed(2)
          })

          const recipientEmail = client.billing_email || client.email
          
          if (recipientEmail && recipientEmail.includes("@")) {
            await sendEmail({
              to: recipientEmail,
              subject: `Linke | Fatura de Envios (${invoiceRes.moloniDocumentNumber || invoiceRes.statementNumber})`,
              html: emailHtml,
              attachments: pdfAttachment ? [pdfAttachment] : undefined
            })
          }

          results.push({ client: client.name || client.short_name, shipmentsCount: unbilledShipments.length, total, emailed: !!recipientEmail, invoice: invoiceRes.moloniDocumentNumber })
        }
      }
    }

    return NextResponse.json({ success: true, processed: results, debug: debugLogs })
  } catch (error: any) {
    console.error("Cron Billing Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return GET(request)
}
