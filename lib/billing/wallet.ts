import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { payAsYouGoRefusal } from './client-balance'

export type WalletReservation = { tenant: string; client: string; shipment: string; reserved: boolean; balanceBefore?: number }

/** Only the server-calculated selling total can enter this service. SQL serializes by client. */
export async function reserveWallet(db: SupabaseClient, tenant: string, client: string, shipment: string, amount: number, reference: string) {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Não foi possível validar o custo do envio.')
  const { data, error } = await db.rpc('reserve_shipment_wallet', {
    p_tenant: tenant, p_client: client, p_shipment: shipment, p_amount: amount, p_reference: reference,
  })
  if (error || !data) throw new Error('Não foi possível reservar o saldo. Confirme a configuração da wallet antes de repetir.')
  if (data.refused) throw new Error(payAsYouGoRefusal(Number(data.balance), amount) || 'Saldo insuficiente.')
  return { tenant, client, shipment, reserved: data.reserved === true, balanceBefore: data.balance == null ? undefined : Number(data.balance) } satisfies WalletReservation
}

export async function transitionWallet(db: SupabaseClient, reservation: WalletReservation | undefined,
  from: 'reserved' | 'submitted', to: 'submitted' | 'consumed' | 'released', result?: Record<string, unknown>) {
  if (!reservation?.reserved) return
  const { data, error } = await db.rpc('transition_wallet_reservation', { p_tenant: reservation.tenant,
    p_client: reservation.client, p_shipment: reservation.shipment, p_from: from, p_to: to, p_result: result || null })
  if (error || data !== true) throw new Error(`O saldo do pedido ${reservation.shipment} ficou reservado. Confirme o resultado antes de repetir.`)
}

export async function walletSnapshot(db: SupabaseClient, tenant: string, client: string) {
  const { data, error } = await db.rpc('client_wallet_snapshot', { p_tenant: tenant, p_client: client })
  if (error || !data || ![data.credit, data.spent, data.reserved, data.balance].every(v => Number.isFinite(Number(v)))) {
    throw new Error('Não foi possível confirmar o saldo da wallet.')
  }
  return { credit: Number(data.credit), spent: Number(data.spent), reserved: Number(data.reserved), balance: Number(data.balance) }
}
