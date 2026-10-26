import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { payAsYouGoRefusal } from './client-balance'

export type WalletReservation = { tenant: string; client: string; shipment: string; reserved: boolean; balanceBefore?: number; kind?: 'credit_limit' }

/** Only the server-calculated selling total can enter this service. SQL serializes by client. */
export async function reserveWallet(db: SupabaseClient, tenant: string, client: string, shipment: string, amount: number, reference: string) {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Não foi possível validar o custo do envio.')
  const { data: profile, error: profileError } = await db.from('audit_log').select('details')
    .eq('tenant_id', tenant).eq('action', 'client_data').eq('details->>id', client)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (profileError || !profile?.details) throw new Error('Não foi possível validar as condições de crédito do cliente.')
  if (profile.details.billing_type !== 'pay_as_you_go') {
    if (profile.details.credit_limit_enabled !== true) return { tenant, client, shipment, reserved: false } satisfies WalletReservation
    const { data: credit, error: creditError } = await db.rpc('reserve_current_account_credit', {
      p_tenant: tenant, p_client: client, p_shipment: shipment, p_amount: amount, p_reference: reference,
    })
    if (creditError?.code === 'PGRST202') {
      throw new Error('Falta aplicar a migração de limite de crédito no Supabase (20261026170000_current_account_credit_limit.sql).')
    }
    if (creditError || !credit) throw new Error('Não foi possível reservar o crédito da conta. Atualize a página e confirme o pedido antes de repetir.')
    if (credit.refused) throw new Error(`Limite de crédito atingido: disponível ${Number(credit.balance).toFixed(2)}€, custo do envio ${amount.toFixed(2)}€. Contacte geral@linke.pt.`)
    return { tenant, client, shipment, reserved: credit.reserved === true, balanceBefore: Number(credit.balance), kind: 'credit_limit' } satisfies WalletReservation
  }
  const { data, error } = await db.rpc('reserve_shipment_wallet', {
    p_tenant: tenant, p_client: client, p_shipment: shipment, p_amount: amount, p_reference: reference,
  })
  if (error) {
    if (error.code === 'PGRST202') {
      const { loadClientShipmentsForBalance, loadClientStatementsForBalance, payAsYouGoBalance } = await import('./client-balance')
      const [shipments, statements] = await Promise.all([
        loadClientShipmentsForBalance(db, tenant, client),
        loadClientStatementsForBalance(db, tenant, client)
      ])
      const balance = payAsYouGoBalance(profile?.details?.credit_limit, shipments, statements, profile?.details?.pay_as_you_go_since)
      const refusal = payAsYouGoRefusal(balance, amount)
      if (refusal) throw new Error(refusal)
      return { tenant, client, shipment, reserved: true, balanceBefore: balance } satisfies WalletReservation
    }
    throw new Error('Não foi possível reservar o saldo. Confirme a configuração da wallet antes de repetir.')
  }
  if (!data) throw new Error('Não foi possível reservar o saldo. Confirme a configuração da wallet antes de repetir.')
  if (data.refused) throw new Error(payAsYouGoRefusal(Number(data.balance), amount) || 'Saldo insuficiente.')
  return { tenant, client, shipment, reserved: data.reserved === true, balanceBefore: data.balance == null ? undefined : Number(data.balance) } satisfies WalletReservation
}

export async function transitionWallet(db: SupabaseClient, reservation: WalletReservation | undefined,
  from: 'reserved' | 'submitted', to: 'submitted' | 'consumed' | 'released', result?: Record<string, unknown>) {
  if (!reservation?.reserved) return
  const { data, error } = await db.rpc(reservation.kind === 'credit_limit' ? 'transition_credit_limit_reservation' : 'transition_wallet_reservation', { p_tenant: reservation.tenant,
    p_client: reservation.client, p_shipment: reservation.shipment, p_from: from, p_to: to, p_result: result || null })
  if (error && error.code === 'PGRST202' && reservation.kind !== 'credit_limit') return
  if (error || data !== true) throw new Error(`O saldo do pedido ${reservation.shipment} ficou reservado. Confirme o resultado antes de repetir.`)
}

export async function walletSnapshot(db: SupabaseClient, tenant: string, client: string) {
  const { data, error } = await db.rpc('client_wallet_snapshot', { p_tenant: tenant, p_client: client })
  if (error) {
    if (error.code === 'PGRST202') return null
    throw new Error('Não foi possível confirmar o saldo da wallet.')
  }
  if (!data || ![data.credit, data.spent, data.reserved, data.balance].every(v => Number.isFinite(Number(v)))) {
    throw new Error('Não foi possível confirmar o saldo da wallet.')
  }
  return { credit: Number(data.credit), spent: Number(data.spent), reserved: Number(data.reserved), balance: Number(data.balance) }
}
