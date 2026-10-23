import { getAuthContext } from '@/lib/auth/context'
import { createAdminClient } from '@/lib/supabase/server'
import { authorizeMeasurementShipment, readShipmentMeasurements } from '@/lib/services/shipments/shipment-measurements'
import { fetchCttTrackingEvents } from '@/lib/services/tracking/ctt-tracking-sync'
import { fetchCorreosTrackingEvents } from '@/lib/services/tracking/correos-tracking-sync'
import { saveCarrierMeasurements } from '@/lib/services/tracking/carrier-measurements-store'
import { isCorreosShipment } from '@/lib/services/shipments/shipment-utils'

export const maxDuration = 60
type RouteContext = { params: Promise<{ id: string }> }
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' }
const reply = (body: object, status = 200) => Response.json(body, { status, headers })

async function handle(request: Request, route: RouteContext, refresh: boolean) {
  if (refresh && request.headers.get('origin') !== new URL(request.url).origin) return reply({ error: 'Origem não autorizada.' }, 403)
  const ctx = await getAuthContext()
  if (!ctx) return reply({ error: 'Inicie sessão para consultar as medições.' }, 401)
  if (!ctx.tenant_id || (ctx.role !== 'employee' && ctx.role !== 'admin' && ctx.role !== 'client')) {
    return reply({ error: 'Sem acesso a este envio.' }, 403)
  }
  const { id } = await route.params
  try {
    const db = createAdminClient()
    const shipment = await authorizeMeasurementShipment(db, ctx, id)
    if (!shipment) return reply({ error: 'Sem acesso a este envio.' }, 403)
    if (refresh) {
      // Always use the authorized stored reference; never accept a tracking
      // number from the caller. This operation does not update status or prices.
      const tracking = shipment.carrier_tracking_number || shipment.ctt_object_id || shipment.tracking_number
      if (!tracking || /^L[TK]{2}/i.test(tracking)) return reply({ error: 'Este envio ainda não tem uma referência da transportadora.' }, 422)
      const result = isCorreosShipment(shipment)
        ? await fetchCorreosTrackingEvents(tracking) : await fetchCttTrackingEvents(tracking)
      if (!result.success) return reply({ error: 'Não foi possível consultar a transportadora. Tente novamente.' }, 502)
      await saveCarrierMeasurements(db, shipment, result.events)
    }
    return reply(await readShipmentMeasurements(db, shipment))
  } catch {
    return reply({ error: 'Não foi possível carregar as medições. Tente novamente.' }, 503)
  }
}

export async function GET(request: Request, context: RouteContext) { return handle(request, context, false) }
export async function POST(request: Request, context: RouteContext) { return handle(request, context, true) }
