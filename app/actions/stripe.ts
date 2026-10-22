"use server"

import { createAdminClient } from "@/lib/supabase/server"
import { requireUser } from "@/lib/auth/context"
import { checkoutReturnOrigin } from "@/lib/config/public-origins"

async function getStripe() {
  const StripeModule = await import("stripe")
  const StripeClass = (StripeModule as any).default || StripeModule
  return new StripeClass(process.env.STRIPE_SECRET_KEY || "sk_test_dummy", {
    apiVersion: "2026-08-26.dahlia" as any,
  })
}

export async function createTopUpCheckoutSession(clientId: string, amountEuro: number) {
  try {
    const ctx = await requireUser()
    const { headers } = await import("next/headers")
    const headersList = await headers()
    const origin = checkoutReturnOrigin(headersList.get("origin"))
    if (ctx.role === "client" && ctx.client_id !== clientId) {
      throw new Error("Não autorizado a carregar esta conta.")
    }

    const cents = Math.round(amountEuro * 100)
    if (typeof amountEuro !== "number" || !Number.isFinite(amountEuro) || !Number.isSafeInteger(cents)
      || cents < 100 || Math.abs(amountEuro * 100 - cents) > 1e-7) {
      throw new Error("Indique um montante válido de pelo menos 1€, com no máximo duas casas decimais.")
    }
    const supabase = createAdminClient()

    console.log("[Stripe Action] Received clientId:", clientId, "Amount:", amountEuro)

    // 1. Validate Client
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .eq('tenant_id', ctx.tenant_id)
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
    const stripe = await getStripe()
    const { getPortalDestination } = await import("@/lib/client-portal/access")
    const destination = await getPortalDestination(client.id).catch(() => "")
    const successUrl = destination ? `${origin}${destination}?topup=success` : `${origin}/app?topup=success`
    const cancelUrl = destination ? `${origin}${destination}?topup=cancelled` : `${origin}/app?topup=cancelled`

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
            unit_amount: cents, // Stripe usa cêntimos
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: transaction.id,
      metadata: {
        transaction_id: transaction.id,
        client_id: client.id,
        tenant_id: client.tenant_id
      }
    }, { idempotencyKey: `tms-topup-${transaction.id}` })

    // 4. Update Transaction with Stripe Session ID
    const { data: bound, error: bindingError } = await supabase
      .from('client_transactions')
      .update({ stripe_session_id: session.id })
      .eq('id', transaction.id).eq('tenant_id', ctx.tenant_id).eq('client_id', client.id)
      .eq('status', 'pending').select('id').maybeSingle()
    if (bindingError || !bound || !session.url) {
      // Keep the durable transaction for reconciliation; do not expose an unbound payment URL.
      throw new Error(`Não foi possível preparar o pagamento. Referência: ${transaction.id}. Confirme esta tentativa antes de repetir.`)
    }

    return { success: true, url: session.url }
  } catch (error: any) {
    console.error("createTopUpCheckoutSession Error:", error)
    return { success: false, error: error.message }
  }
}

export async function getClientTransactionsAction(clientId?: string) {
  try {
    const ctx = await requireUser()
    const effectiveClientId = ctx.role === "client" ? ctx.client_id : clientId
    if (!effectiveClientId) return []
    if (ctx.role === "client" && ctx.client_id !== effectiveClientId) {
      throw new Error("Não autorizado.")
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("client_transactions")
      .select("id, client_id, amount, status, stripe_session_id, created_at, updated_at")
      .eq("tenant_id", ctx.tenant_id)
      .eq("client_id", effectiveClientId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching client transactions:", error.message)
      return []
    }
    return data || []
  } catch (error: any) {
    console.error("getClientTransactionsAction Error:", error)
    return []
  }
}
