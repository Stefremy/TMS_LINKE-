"use server"

import { createAdminClient } from "@/lib/supabase/server"
import Stripe from "stripe"
import { headers } from "next/headers"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2026-08-26.dahlia" as any,
})

export async function createTopUpCheckoutSession(clientId: string, amountEuro: number) {
  try {
    const supabase = createAdminClient()

    console.log("[Stripe Action] Received clientId:", clientId, "Amount:", amountEuro)

    // 1. Validate Client
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()

    if (clientErr || !client) {
      console.error("[Stripe Action] Error fetching client:", clientErr, "for ID:", clientId)
      throw new Error("Cliente não encontrado. ID recebido: " + (clientId || "Vazio"))
    }

    if (amountEuro < 1) {
      throw new Error("O montante mínimo de carregamento é 1€.")
    }

    // 2. Create Transaction Record
    const { data: transaction, error: txErr } = await supabase
      .from('client_transactions')
      .insert({
        tenant_id: client.tenant_id,
        client_id: client.id,
        amount: amountEuro,
        status: 'pending'
      })
      .select()
      .single()

    if (txErr) {
      console.error(txErr)
      throw new Error("Erro ao criar a transação na base de dados.")
    }

    // 3. Create Stripe Checkout Session
    const headersList = await headers()
    const origin = headersList.get("origin") || "http://localhost:3000"

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'mb_way', 'multibanco'],
      // payment_method_types: ['mb_way', 'card'],
      
      // We will force mbway and card if needed, but actually the dashboard manages this now via `automatic_payment_methods`
      // So we will use automatic_payment_methods: { enabled: true } instead.
      
      customer_email: client.email || undefined,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Carregamento de Saldo - TMS Linke',
              description: `Carregamento para a conta ${client.legal_name || client.short_name}`,
            },
            unit_amount: Math.round(amountEuro * 100), // Stripe usa cêntimos
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/app?topup=success`,
      cancel_url: `${origin}/app?topup=cancelled`,
      client_reference_id: transaction.id,
      metadata: {
        transaction_id: transaction.id,
        client_id: client.id,
        tenant_id: client.tenant_id
      }
    })

    // 4. Update Transaction with Stripe Session ID
    await supabase
      .from('client_transactions')
      .update({ stripe_session_id: session.id })
      .eq('id', transaction.id)

    return { success: true, url: session.url }
  } catch (error: any) {
    console.error("createTopUpCheckoutSession Error:", error)
    return { success: false, error: error.message }
  }
}
