import { randomInt } from "node:crypto"
import { revalidatePath } from "next/cache"
import { requireEmployee } from "@/lib/auth/context"
import { createAdminClient } from "@/lib/supabase/server"
import { errorMessage } from "@/lib/errors"
import { isValidUuid } from "@/lib/services/shipments/shipment-utils"
import { reserveWallet, transitionWallet, type WalletReservation } from "@/lib/billing/wallet"
import { resolveShipmentTaxRate, type InvoiceShipment } from "@/lib/billing/shipment-invoice-lines"

/** Fields that belong to one specific emission and must never be copied to the duplicate. */
const PER_EMISSION_FIELDS = [
  "id", "tracking_number", "reference", "carrier_tracking_number", "ctt_object_id", "status", "ops_substatus",
  "billing_statement_id", "is_invoiced", "invoiced", "payment_status", "created_at", "updated_at",
  "ctt_label_base64", "ctt_close_data", "ctt_documents", "label_base64", "carrier_labels", "delivered_at",
] as const

const DEFAULT_DIMENSION_CM = 20

type PackageDimensions = { length_cm?: unknown; width_cm?: unknown; height_cm?: unknown; unit?: unknown } | null | undefined

const positive = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Original dimensions in cm, or 20x20x20 when the original has none saved. */
function resolveDimensions(saved: { length_cm?: unknown; width_cm?: unknown; height_cm?: unknown }, packages: { dimensions?: PackageDimensions }[]) {
  const dims = packages.length === 1 && (!packages[0].dimensions?.unit || packages[0].dimensions.unit === "cm")
    ? packages[0].dimensions : null
  return {
    length_cm: positive(saved.length_cm) ?? positive(dims?.length_cm) ?? DEFAULT_DIMENSION_CM,
    width_cm: positive(saved.width_cm) ?? positive(dims?.width_cm) ?? DEFAULT_DIMENSION_CM,
    height_cm: positive(saved.height_cm) ?? positive(dims?.height_cm) ?? DEFAULT_DIMENSION_CM,
  }
}

export type ShipmentDuplicatePreview = {
  clientId: string
  originalTracking: string
  service: string
  senderName: string
  senderAddress: string
  recipientName: string
  recipientAddress: string
  volumes: number
  weightKg: number | null
  codValue: number
  sellPrice: number
}

async function loadOriginal(shipmentId: string, tenantId: string) {
  const supabase = createAdminClient()
  const id = String(shipmentId || "").trim()
  if (!id || !/^[A-Za-z0-9-]+$/.test(id)) return null
  const filter = isValidUuid(id)
    ? `id.eq.${id},tracking_number.eq.${id}`
    : `tracking_number.eq.${id},carrier_tracking_number.eq.${id}`
  const { data, error } = await supabase.from("shipments").select("*").eq("tenant_id", tenantId).or(filter).limit(1)
  if (error) throw new Error(error.message)
  const shipment = data?.[0]
  if (!shipment) return null

  // Draft data (service code, contacts, parcel measurements, pricing snapshot) lives in the audit trail.
  const { data: audit } = await supabase.from("audit_log").select("details")
    .eq("tenant_id", tenantId).eq("action", "shipment_data").eq("details->>id", shipment.id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle()

  const saved = { ...shipment, ...(audit?.details as Record<string, unknown> | undefined) }
  const { data: packages } = await supabase.from("packages").select("weight_g,dimensions")
    .eq("tenant_id", tenantId).eq("shipment_id", shipment.id).limit(1001)
  return { shipment, saved, packages: packages || [] }
}

const text = (value: unknown) => (value == null ? "" : String(value))

function previewOf(shipment: Record<string, unknown>, saved: Record<string, unknown>, packageCount: number): ShipmentDuplicatePreview {
  return {
    clientId: text(shipment.client_id),
    originalTracking: text(shipment.tracking_number || shipment.id),
    service: text(shipment.service_type),
    senderName: text(saved.sender_name),
    senderAddress: text(saved.sender_address),
    recipientName: text(saved.recipient_name),
    recipientAddress: text(saved.recipient_address),
    volumes: Number(saved.package_count || packageCount || 1),
    weightKg: saved.weight_kg == null ? null : Number(saved.weight_kg),
    codValue: Number(saved.cod_value || 0),
    sellPrice: Number(saved.sell_price || 0),
  }
}

export async function previewShipmentDuplicate(shipmentId: string) {
  const ctx = await requireEmployee("Emissão e Controlo de Guias CTT")
  try {
    const original = await loadOriginal(shipmentId, ctx.tenant_id)
    if (!original) return { success: false as const, error: "Envio original não encontrado." }
    return { success: true as const, preview: previewOf(original.shipment, original.saved, original.packages.length) }
  } catch (err) {
    return { success: false as const, error: errorMessage(err) || "Erro ao carregar o envio." }
  }
}

/**
 * Duplicates a shipment for the same client (same store) as a new draft with a new Linke
 * tracking number. Nothing is sent to the carrier: the draft is emitted afterwards like any
 * other. Billing and carrier identifiers of the original are never copied.
 */
export async function duplicateShipment(shipmentId: string, options: { clientReference?: string } = {}) {
  const ctx = await requireEmployee("Emissão e Controlo de Guias CTT")
  const supabase = createAdminClient()
  let reservation: WalletReservation | undefined
  try {
    const original = await loadOriginal(shipmentId, ctx.tenant_id)
    if (!original) return { success: false as const, error: "Envio original não encontrado." }
    const { shipment, saved, packages } = original

    const newId = crypto.randomUUID()
    const newTracking = `LTK${randomInt(1_000_000, 10_000_000)}`
    const now = new Date().toISOString()

    const details: Record<string, unknown> = { ...saved }
    for (const field of PER_EMISSION_FIELDS) delete details[field]
    const clientReference = options.clientReference?.trim() || (saved.client_reference as string | undefined)
    const dimensions = resolveDimensions(saved, packages)
    Object.assign(details, dimensions, {
      id: newId, tenant_id: ctx.tenant_id, client_id: shipment.client_id,
      tracking_number: newTracking, reference: newTracking, status: "rascunho",
      client_reference: clientReference || undefined,
      duplicated_from: shipment.id, created_at: now, updated_at: now,
    })

    const sellPrice = Number(shipment.sell_price || 0)
    if (sellPrice > 0) {
      // Same destination as the original, so the same VAT rate the original was priced with.
      const snapshotVat = Number((saved.pricing_snapshot as { vatPct?: unknown } | undefined)?.vatPct)
      const { vatRate } = resolveShipmentTaxRate({ ...(saved as unknown as InvoiceShipment), id: newId, vat_pct: Number.isFinite(snapshotVat) ? snapshotVat : null })
      reservation = await reserveWallet(supabase, ctx.tenant_id, shipment.client_id, newId, sellPrice, newTracking, vatRate)
    }

    const native = await supabase.from("shipments").insert({
      id: newId, tenant_id: ctx.tenant_id, client_id: shipment.client_id,
      tracking_number: newTracking, service_type: shipment.service_type, carrier_code: shipment.carrier_code ?? saved.carrier_code,
      status: "rascunho",
      sender_name: shipment.sender_name, sender_address: shipment.sender_address,
      sender_zip3: shipment.sender_zip3, sender_zip4: shipment.sender_zip4,
      recipient_name: shipment.recipient_name, recipient_address: shipment.recipient_address,
      recipient_zip3: shipment.recipient_zip3, recipient_zip4: shipment.recipient_zip4,
      buy_price: shipment.buy_price, sell_price: shipment.sell_price,
      created_at: now, updated_at: now,
    })
    if (native.error) {
      console.error("Duplicate shipment insert failed:", native.error.message)
      await transitionWallet(supabase, reservation, "reserved", "released")
      return { success: false as const, error: "Não foi possível duplicar o envio. Nenhum pedido foi enviado à transportadora." }
    }
    await transitionWallet(supabase, reservation, "reserved", "consumed")

    const audit = await supabase.from("audit_log").insert({
      tenant_id: ctx.tenant_id, action: "shipment_data", created_at: now, details,
    })
    await supabase.from("audit_log").insert({
      tenant_id: ctx.tenant_id, action: "shipment_duplicated", created_at: now,
      details: { originalShipmentId: shipment.id, newShipmentId: newId, newTracking },
    })

    let warning: string | undefined
    if (audit.error) warning = "Envio duplicado, mas os detalhes completos não ficaram gravados. Confirme o rascunho antes de emitir."
    if (packages.length) {
      const { error } = await supabase.from("packages").insert(packages.map(p => ({
        tenant_id: ctx.tenant_id, shipment_id: newId, weight_g: p.weight_g,
        dimensions: positive(p.dimensions?.length_cm) && positive(p.dimensions?.width_cm) && positive(p.dimensions?.height_cm)
          ? p.dimensions : { ...dimensions, unit: "cm" },
      })))
      if (error) warning = "Envio duplicado, mas os volumes não ficaram gravados. Confirme o rascunho antes de emitir."
    }

    revalidatePath("/ops/envios")
    revalidatePath("/ops")
    revalidatePath("/app", "layout")
    revalidatePath("/app/[storeSlug]/envios", "page")

    return { success: true as const, id: newId, trackingNumber: newTracking, warning }
  } catch (err) {
    try { await transitionWallet(supabase, reservation, "reserved", "released") } catch {}
    console.error("Erro ao duplicar envio:", err)
    return { success: false as const, error: errorMessage(err) || "Erro desconhecido ao duplicar envio" }
  }
}
