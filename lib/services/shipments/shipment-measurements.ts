import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { positiveMeasurement, type ShipmentMeasurementsSummary } from '../tracking/carrier-measurements'
import { CARRIER_MEASUREMENTS_ACTION } from '../tracking/carrier-measurements-store'
import { isCorreosShipment } from './shipment-utils'

type Scope = { role: string | null; tenant_id: string | null; client_id?: string | null }
export type MeasurementShipment = { id: string; tenant_id: string; client_id: string; carrier_code?: string; service_type?: string; carrier_tracking_number?: string; tracking_number?: string; ctt_object_id?: string }

export async function authorizeMeasurementShipment(db: SupabaseClient, ctx: Scope, id: string): Promise<MeasurementShipment | null> {
  if (!ctx.tenant_id || !['client', 'employee', 'admin'].includes(ctx.role || '') ||
    (ctx.role === 'client' && !ctx.client_id) || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) return null
  const { data, error } = await db.from('shipments').select('id,tenant_id,client_id,carrier_code,service_type,carrier_tracking_number,tracking_number')
    .eq('tenant_id', ctx.tenant_id).eq('id', id).maybeSingle()
  if (error) throw new Error('Não foi possível confirmar o acesso ao envio.')
  let row = data
  if (!row) {
    // Audit-only shipments follow the same latest-owner rule as private tracking.
    const audit = await db.from('audit_log')
      .select('id:details->>id,tenant_id:details->>tenant_id,client_id:details->>client_id,carrier_code:details->>carrier_code,service_type:details->>service_type,carrier_tracking_number:details->>carrier_tracking_number,tracking_number:details->>tracking_number,ctt_object_id:details->>ctt_object_id')
      .eq('tenant_id', ctx.tenant_id).eq('action', 'shipment_data').eq('details->>id', id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (audit.error) throw new Error('Não foi possível confirmar o acesso ao envio.')
    row = audit.data
  }
  if (!row || row.id !== id || (ctx.role === 'client' && row.client_id !== ctx.client_id)) return null
  return { ...row, tenant_id: ctx.tenant_id }
}

export async function readShipmentMeasurements(db: SupabaseClient, shipment: MeasurementShipment): Promise<ShipmentMeasurementsSummary> {
  const [audit, packages, measurements, adjustments] = await Promise.all([
    db.from('audit_log').select('billingWeight:details->billing_weight_kg,weight:details->weight_kg,length:details->length_cm,width:details->width_cm,height:details->height_cm')
      .eq('tenant_id', shipment.tenant_id).eq('action', 'shipment_data').eq('details->>id', shipment.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('packages').select('weight_g,dimensions').eq('tenant_id', shipment.tenant_id).eq('shipment_id', shipment.id).limit(100),
    db.from('audit_log').select('details').eq('tenant_id', shipment.tenant_id).eq('action', CARRIER_MEASUREMENTS_ACTION)
      .eq('details->>shipment_id', shipment.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('audit_log').select('details').eq('tenant_id', shipment.tenant_id).eq('action', 'shipment_weight_adjustment')
      .eq('details->>shipment_id', shipment.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (audit.error || packages.error || measurements.error || adjustments.error) throw new Error('Não foi possível carregar as medições do envio.')
  const packageWeights = (packages.data || []).map(row => positiveMeasurement(row.weight_g))
  const grams = packageWeights.length > 0 && packageWeights.every(value => value !== null)
    ? packageWeights.reduce<number>((sum, value) => sum + value!, 0) : null
  const carrier = isCorreosShipment(shipment) ? 'correos' : 'ctt'
  const dimensions = packages.data?.length === 1 ? packages.data[0].dimensions : null
  const saved = measurements.data?.details
  return {
    carrier,
    billingWeightKg: positiveMeasurement(audit.data?.billingWeight),
    ...(adjustments.data?.details ? { weightAdjustment: {
      status: 'adjusted' as const, message: 'Escalão ajustado automaticamente ao peso da transportadora.',
      weightKg: adjustments.data.details.weightKg, previousWeightKg: adjustments.data.details.previousWeightKg,
      price: adjustments.data.details.price, previousPrice: adjustments.data.details.previousPrice, difference: adjustments.data.details.difference,
    } } : {}),
    declared: {
      weightKg: positiveMeasurement(audit.data?.weight) ?? (grams !== null ? grams / 1000 : null),
      lengthCm: positiveMeasurement(audit.data?.length) ?? positiveMeasurement(dimensions?.length_cm),
      widthCm: positiveMeasurement(audit.data?.width) ?? positiveMeasurement(dimensions?.width_cm),
      heightCm: positiveMeasurement(audit.data?.height) ?? positiveMeasurement(dimensions?.height_cm),
    },
    observations: saved?.carrier === carrier && saved.shipment_id === shipment.id ? [saved] : [],
  }
}
