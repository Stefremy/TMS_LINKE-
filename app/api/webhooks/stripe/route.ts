import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createAdminClient } from "@/lib/supabase/server"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy", {
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

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session

      // Only credit if payment is confirmed as paid
      if (session.payment_status !== "paid") {
        console.log(`[Stripe Webhook] Session ${session.id} status is '${session.payment_status}'. Awaiting payment completion.`)
        return NextResponse.json({ received: true, status: "awaiting_payment" }, { status: 200 })
      }

      const transactionId = session.metadata?.transaction_id
      const clientId = session.metadata?.client_id

      if (transactionId && clientId) {
        // 1. Idempotently transition transaction from pending -> paid
        // In Supabase, if status is not 'pending', 0 rows are updated and updatedTx is null.
        const { data: updatedTx, error: txErr } = await supabase
          .from("client_transactions")
          .update({
            status: "paid",
            updated_at: new Date().toISOString(),
            stripe_session_id: session.id,
          })
          .eq("id", transactionId)
          .eq("status", "pending")
          .select("id, amount, client_id")
          .maybeSingle()

        if (txErr) {
          console.error("[Stripe Webhook] Error updating transaction:", txErr.message)
          return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 })
        }

        // If updatedTx is null, this transaction was already processed or does not exist.
        if (!updatedTx) {
          console.warn(`[Stripe Webhook] Transaction ${transactionId} already processed or not pending. Skipping duplicate credit.`)
          return NextResponse.json({ received: true, message: "Transaction already processed" }, { status: 200 })
        }

        // 2. Add amount to client balance exactly once
        const amountEuro = session.amount_total ? session.amount_total / 100 : Number(updatedTx.amount || 0)

        const { data: client, error: clientErr } = await supabase
          .from("clients")
          .select("credit_limit")
          .eq("id", clientId)
          .single()

        if (!clientErr && client) {
          const newBalance = Number(client.credit_limit || 0) + amountEuro

          await supabase
            .from("clients")
            .update({ credit_limit: newBalance })
            .eq("id", clientId)

          console.log(`[Stripe Webhook] Successfully credited ${amountEuro}€ to client ${clientId}. New Balance: ${newBalance}€`)
        }
      }
    } else if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session
      const transactionId = session.metadata?.transaction_id
      if (transactionId) {
        await supabase
          .from("client_transactions")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", transactionId)
          .eq("status", "pending")
        console.log(`[Stripe Webhook] Marked transaction ${transactionId} as failed.`)
      }
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error: any) {
    console.error("Stripe Webhook Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
