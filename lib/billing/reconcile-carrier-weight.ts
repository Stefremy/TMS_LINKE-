import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { latestCarrierReadings, type SavedCarrierMeasurements } from '@/lib/services/tracking/carrier-measurements'
import { planWeightAdjustment, weightInKg, type WeightAdjustmentResult, type WeightPricingBasis } from './carrier-weight-pricing'

/** Internal only: references and owners are reloaded from the tenant's native shipment. */
export async function reconcileCarrierWeight(db: SupabaseClient, tenant: string, shipmentId: string): Promise<WeightAdjustmentResult> {
  if (process.env.CARRIER_WEIGHT_REPRICING_ENABLED !== 'true') return { status: 'disabled', message: 'Ajuste automático de peso desativado.' }
  try {
    const [native, snapshot, observation] = await Promise.all([
      db.from('shipments').select('id,client_id,tenant_id,sell_price,buy_price,billing_statement_id,status,carrier_code,carrier_tracking_number')
        .eq('tenant_id', tenant).eq('id', shipmentId).maybeSingle(),
      db.from('audit_log').select('id,client_id:details->>client_id,weight_kg:details->weight_kg,billing_weight_kg:details->billing_weight_kg,package_count:details->package_count,base_price:details->base_price,fuel_tax_amount:details->fuel_tax_amount,special_fees_amount:details->special_fees_amount,weight_pricing_basis:details->weight_pricing_basis').eq('tenant_id', tenant).eq('action', 'shipment_data').eq('details->>id', shipmentId)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle(),
      db.from('audit_log').select('id,details').eq('tenant_id', tenant).eq('action', 'shipment_carrier_measurements').eq('details->>shipment_id', shipmentId)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (native.error || snapshot.error || observation.error) throw new Error('Não foi possível confirmar os dados do envio.')
    const row = native.data, details = snapshot.data
    if (!row || !details || details.client_id !== row.client_id) return { status: 'review_required', message: 'Falta o registo tarifário original do envio.' }
    if (row.billing_statement_id || ['anulado','cancelado','cancelled','canceled','rascunho','draft'].includes(row.status)) return { status: 'locked', message: 'Envio faturado, cancelado ou em rascunho; preço preservado.' }
    const saved = observation.data?.details as SavedCarrierMeasurements | undefined
    if (!saved || saved.shipment_id !== shipmentId || saved.carrier !== row.carrier_code ||
        saved.measurements.source !== (saved.carrier === 'ctt' ? 'ctt_events_v3' : 'correos_tracking')) return { status: 'unchanged', message: 'Sem peso da transportadora disponível.' }
    const measured = latestCarrierReadings([saved])
    const kg = weightInKg(measured?.weight, saved.carrier === 'ctt' ? process.env.CTT_MEASURED_WEIGHT_UNIT : undefined)
    if (kg === null) return { status: 'review_required', message: 'Confirme a unidade do peso CTT antes de ativar a conversão automática.' }
    if (Number(details.package_count ?? 1) > 1) return { status: 'review_required', message: 'Envio com vários volumes: confirme se o peso comunicado é o total antes de ajustar.' }
    const basis = details.weight_pricing_basis as unknown as WeightPricingBasis | undefined
    if (!basis) return { status: 'review_required', message: 'Envio anterior ao registo da tarifa original; requer revisão no OPS.' }
    const plan = planWeightAdjustment({ basis, previousWeightKg: Number(details.billing_weight_kg ?? details.weight_kg), weightKg: kg,
      sellPrice: row.sell_price, buyPrice: row.buy_price, basePrice: details.base_price, fuelAmount: details.fuel_tax_amount,
      specialAmount: details.special_fees_amount ?? 0 })
    if (!plan) return { status: 'unchanged', message: 'O peso comunicado não aumenta o preço do envio.' }
    const { data, error } = await db.rpc('apply_carrier_weight_adjustment', {
      p_tenant: tenant, p_client: row.client_id, p_shipment: shipmentId,
      p_snapshot: snapshot.data!.id, p_measurement: observation.data!.id, p_expected_price: Number(row.sell_price),
      p_expected_buy: Number(row.buy_price), p_plan: plan,
    })
    if (error) throw new Error('Ajuste não aplicado. Confirme a migração e o estado de faturação no OPS.')
    if (data?.status !== 'adjusted') return { status: data?.status === 'locked' ? 'locked' : 'unchanged', message: 'Preço preservado; o envio foi faturado ou alterado durante a consulta.' }
    return { status: 'adjusted', message: 'Escalão e preço ajustados automaticamente ao peso da transportadora.',
      previousWeightKg: plan.previousWeightKg, weightKg: plan.weightKg, previousPrice: plan.previousPrice, price: plan.price, difference: plan.difference }
  } catch (error) {
    return { status: 'unavailable', message: error instanceof Error ? error.message : 'Não foi possível ajustar o peso.' }
  }
}
