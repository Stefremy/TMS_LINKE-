import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createAdminClient } from "@/lib/supabase/server"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2026-08-26.dahlia" as any,
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

export async function POST(req: Request) {
  try {
    const body = await req.text()
    const signature = req.headers.get("stripe-signature")

    if (!signature || !webhookSecret) {
      return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 })
    }

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err: any) {
      console.error("Webhook signature verification failed.", err.message)
      return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 })
    }

    const supabase = createAdminClient()

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session
      
      const transactionId = session.metadata?.transaction_id
      const clientId = session.metadata?.client_id

      if (transactionId && clientId) {
        // 1. Marcar a transação como paga
        const { error: txErr } = await supabase
          .from("client_transactions")
          .update({ status: "paid", updated_at: new Date().toISOString() })
          .eq("id", transactionId)
          .eq("status", "pending") // Para não processar a mesma 2 vezes

        if (!txErr) {
          // 2. Adicionar o valor ao saldo do cliente
          const amountEuro = (session.amount_total || 0) / 100

          const { data: client, error: clientErr } = await supabase
            .from("clientes")
            .select("credit_limit")
            .eq("id", clientId)
            .single()

          if (!clientErr && client) {
            const newBalance = Number(client.credit_limit || 0) + amountEuro
            
            await supabase
              .from("clientes")
              .update({ credit_limit: newBalance })
              .eq("id", clientId)
              
            console.log(`Successfully added ${amountEuro}€ to client ${clientId}. New Balance: ${newBalance}€`)
          }
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error: any) {
    console.error("Stripe Webhook Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
