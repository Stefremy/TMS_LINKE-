import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createAdminClient } from "@/lib/supabase/server"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy")
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

export async function POST(req: Request) {
  try {
    const body = await req.text()
    const signature = req.headers.get("stripe-signature")
    if (!signature || !webhookSecret) return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 })
    let event: Stripe.Event
    try { event = stripe.webhooks.constructEvent(body, signature, webhookSecret) }
    catch { return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 }) }

    const paid = event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded"
    const failed = event.type === "checkout.session.async_payment_failed"
    if (!paid && !failed) return NextResponse.json({ received: true })
    const session = event.data.object as Stripe.Checkout.Session
    if (paid && session.payment_status !== "paid") return NextResponse.json({ received: true, status: "awaiting_payment" })
    const transactionId = session.metadata?.transaction_id
    const clientId = session.metadata?.client_id
    const tenantId = session.metadata?.tenant_id
    if (!transactionId || !clientId || !tenantId || session.mode !== "payment" || session.currency !== "eur"
      || session.client_reference_id !== transactionId || !Number.isSafeInteger(session.amount_total) || session.amount_total! < 100) {
      return NextResponse.json({ error: "Invalid checkout binding" }, { status: 400 })
    }
    const db = createAdminClient()
    const { data: tx, error: readError } = await db.from("client_transactions")
      .select("id,tenant_id,client_id,amount,stripe_session_id,status,credited_at")
      .eq("id", transactionId).maybeSingle()
    if (readError || !tx) return NextResponse.json({ error: "Transaction unavailable" }, { status: 500 })
    if (tx.tenant_id !== tenantId || tx.client_id !== clientId || Math.round(Number(tx.amount) * 100) !== session.amount_total
      || (tx.stripe_session_id && tx.stripe_session_id !== session.id)) {
      return NextResponse.json({ error: "Checkout does not match transaction" }, { status: 400 })
    }
    // A webhook can arrive before checkout setup finishes. Never infer the binding from metadata.
    if (!tx.stripe_session_id) return NextResponse.json({ error: "Checkout binding pending" }, { status: 500 })
    if (failed) {
      const { error } = await db.from("client_transactions").update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", tx.id).eq("tenant_id", tx.tenant_id).eq("client_id", tx.client_id)
        .eq("stripe_session_id", session.id).eq("status", "pending")
      if (error) throw new Error("Failed to record payment failure")
    } else {
      // Status, target balance and fulfillment marker commit together, or all roll back.
      const { data, error } = await db.rpc("settle_stripe_topup", { p_transaction: tx.id, p_tenant: tx.tenant_id,
        p_client: tx.client_id, p_session: session.id, p_cents: session.amount_total, p_event: event.id })
      if (error || !["credited", "already_credited", "legacy_reconciliation_required"].includes(data)) throw new Error("Payment fulfillment pending")
      if (data === "legacy_reconciliation_required") return NextResponse.json({ received: true, status: data })
    }
    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ error: "Payment fulfillment pending; retry delivery" }, { status: 500 })
  }
}
