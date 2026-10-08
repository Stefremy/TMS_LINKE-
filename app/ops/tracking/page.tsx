import React from "react"
import { Metadata } from "next"
import { DeliveryTrackingClient } from "./components/DeliveryTrackingClient"
import { getShipmentsAction } from "@/app/actions/shipments"
import { createAdminClient } from "@/lib/supabase/server"
import { resolveLocationCoordinate } from "@/lib/services/geo/coordinates"
import { resolveCoordinates } from "@/lib/services/geo/geocoder"
import { TrackingShipment, ShipmentPickagem } from "./types"

export const metadata: Metadata = {
  title: "Monitorização & Tracking por Pickagens | Linke TMS",
  description: "Rastreio e itinerários geolocalizados por pickagens e checkpoints de rede.",
}
import Link from "next/link"

export default async function OpsTrackingPage(props: {
  searchParams?: Promise<{ tab?: string; search?: string }> | { tab?: string; search?: string }
}) {
  const supabase = createAdminClient()
  const resolvedSearchParams = await props.searchParams
  const tabParam = resolvedSearchParams?.tab || "active"
  const searchQ = (resolvedSearchParams?.search || "").trim()
  const isDeliveredTab = tabParam === "entregues"
  let realShipmentsMapped: TrackingShipment[] = []

  try {
    const shipments = await getShipmentsAction({ includeLabels: false })
    const activeShipments = (shipments || []).filter(
      (s: any) => {
        if (searchQ) {
          const match = s.tracking_number?.toLowerCase().includes(searchQ.toLowerCase()) || s.reference?.toLowerCase().includes(searchQ.toLowerCase())
          return match
        }
        if (isDeliveredTab) return s.status === "entregue" || s.status === "devolvido"
        return s.status === "em_transito" || s.status === "em transito" || s.status === "em_distribuicao" || s.status === "pendente"
      }
    ).slice(0, searchQ ? 50 : 15)

    const shipmentIds = activeShipments.map((s: any) => s.id)
    const eventsByShipment: Record<string, any[]> = {}

    if (shipmentIds.length > 0) {
      const { data: dbEvents } = await supabase
        .from("tracking_events")
        .select("*")
        .in("shipment_id", shipmentIds)
        .order("timestamp", { ascending: true })

      if (dbEvents) {
        dbEvents.forEach((e: any) => {
          if (!eventsByShipment[e.shipment_id]) eventsByShipment[e.shipment_id] = []
          eventsByShipment[e.shipment_id].push(e)
        })
      }
    }

    realShipmentsMapped = await Promise.all(
      activeShipments.map(async (s: any) => {
        const isArriving = s.status === "em_distribuicao"

        const senderZip = s.sender_zip4 && s.sender_zip3 ? `${s.sender_zip4}-${s.sender_zip3}` : s.sender_postal_code
        const recipientZip = s.recipient_zip4 && s.recipient_zip3 ? `${s.recipient_zip4}-${s.recipient_zip3}` : s.recipient_postal_code

        const senderLocationName = s.sender_city || s.sender_address || "Local Desconhecido"
        const recipientLocationName = s.recipient_city || s.recipient_address || "Local Desconhecido"

        // Resolve origin + destination in parallel using the smart geocoder
        // (postal code SQLite DB + known CTT hubs/cities)
        const [originCoord, destCoord] = await Promise.all([
          resolveCoordinates({
            address: s.sender_address,
            city: s.sender_city,
            postalCode: senderZip,
            country: "PT",
            useApi: false,
          }),
          resolveCoordinates({
            address: s.recipient_address,
            city: s.recipient_city,
            postalCode: recipientZip,
            country: "PT",
            useApi: false,
          }),
        ])

        const dbEvts = eventsByShipment[s.id] || []

        // Build pickagens list from real DB events ONLY
        const pickagens: ShipmentPickagem[] = []

        // Real scans from tracking_events table
        for (let idx = 0; idx < dbEvts.length; idx++) {
          const e = dbEvts[idx]
          // Try location_name first, then description, then sender city
          const rawLocation = e.location_name || e.description || senderLocationName

          const parenMatch = rawLocation.match(/\(([^)]+)\)[^()]*$/)
          let candidateCity = parenMatch && parenMatch[1] ? parenMatch[1].trim() : rawLocation
          candidateCity = candidateCity.replace(/^(c\.?\s*o\.?|co|ctc|cd|cdp|hub|centro operacional|centro de tratamento|plataforma|cais|delegação|delegacion|delegación|correos express|posto)\s+/i, "").trim()

          const isEntregueEvent = e.description?.toUpperCase().includes("ENTREGUE") || e.description?.toUpperCase().includes("ENTREGA CONSEGUIDA") || e.event_code === "EMI"

          let evtCoord
          if (isEntregueEvent) {
            evtCoord = destCoord
          } else {
            let countryCode = "PT"
            const isCorreos = s.carrier_code === "correos" || s.carrier_name?.toLowerCase().includes("correos") || s.provider === "correos_express"
            if (isCorreos) {
              // For Correos Express, it might be Portugal, Spain or International (Europe)
              countryCode = ""
            }

            evtCoord = await resolveCoordinates({
              city: candidateCity,
              country: countryCode,
              useApi: true
            })
          }

          // If geo lookup returned the generic fallback, inherit last known checkpoint position (or origin if first)
          const isGenericFallback = evtCoord.lat === 39.5 && evtCoord.lng === -8.5
          const lastKnown = pickagens.length > 0
            ? { lat: pickagens[pickagens.length - 1].lat, lng: pickagens[pickagens.length - 1].lng, name: pickagens[pickagens.length - 1].locationName, district: pickagens[pickagens.length - 1].city }
            : originCoord

          const finalLat = isGenericFallback ? lastKnown.lat : evtCoord.lat
          const finalLng = isGenericFallback ? lastKnown.lng : evtCoord.lng
          const isLast = idx === dbEvts.length - 1
          pickagens.push({
            id: `pick-${e.id || idx}`,
            code: e.event_code || "TRN",
            title: e.description || "Passagem em Ponto de Controlo",
            locationName: isGenericFallback ? (rawLocation || lastKnown.name) : evtCoord.name,
            city: isGenericFallback ? (lastKnown.district || s.sender_city || "Portugal") : (evtCoord.district || s.sender_city || "Portugal"),
            lat: finalLat,
            lng: finalLng,
            timestamp: e.timestamp || e.created_at,
            formattedTime: e.timestamp ? new Date(e.timestamp).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }) : "11:30",
            status: isLast && s.status !== "entregue" ? "current" : "completed",
            isCurrentPosition: isLast,
            description: e.description
          })
        }

        const completedScans = pickagens.filter(p => p.status === "completed" || p.status === "current").length
        
        const isEntregue = s.status === "entregue" || s.status === "devolvido" || s.status === "entregue_pudo"
        let progressPercent = 0
        if (isEntregue) {
          progressPercent = 100
        } else if (isArriving) {
          progressPercent = 85
        } else if (s.status === "em_transito" || s.status === "em transito") {
          progressPercent = 50
        } else if (pickagens.length > 0) {
          progressPercent = 25
        }
        
        const totalEstimatedScans = isEntregue ? completedScans : completedScans + 2

        const rawCarrier = s.provider === "correos_express" ? "Correos Express" : (s.service_type || "Linke Express")
        const finalCarrier = rawCarrier.toLowerCase().includes("ctt") ? "CTT Expresso" : rawCarrier
        const finalServiceType = (s.service_type || "Distribuição Rodoviária").toLowerCase().includes("ctt")
          ? "CTT Expresso 24h"
          : (s.service_type || "Distribuição Rodoviária")

        const isDelivered = isEntregue
        let dynamicEta = "Hoje, até 19:00"
        let dynamicRemaining = "A calcular..."

        if (isDelivered) {
          dynamicEta = "Entregue"
          dynamicRemaining = "0h 00m"
        } else if (isArriving) {
          dynamicEta = "Hoje, até 19:00"
          dynamicRemaining = "± 1h 30m"
        } else {
          const createdDate = s.created_at ? new Date(s.created_at) : new Date()
          const today = new Date()
          const isCreatedToday = createdDate.getDate() === today.getDate() && createdDate.getMonth() === today.getMonth()
          
          if (isCreatedToday) {
            dynamicEta = "Amanhã, até 19:00"
            dynamicRemaining = "± 24h"
          } else {
            dynamicEta = "Hoje, até 19:00"
            dynamicRemaining = "± 4h"
          }
        }

        return {
          id: s.id,
          displayId: s.tracking_number || s.reference || `#ENV-${s.id.slice(0, 8).toUpperCase()}`,
          trackingNumber: s.tracking_number || s.id,
          status: isDelivered ? "departed" : isArriving ? "arriving" : "active",
          rawStatus: s.status,
          statusLabel: isArriving ? "A Chegar" : "Em Trânsito",
          carrier: finalCarrier,
          serviceType: finalServiceType,
          isRealData: true,
          origin: {
            hubName: s.sender_name || `Origem: ${originCoord.name}`,
            city: s.sender_city || originCoord.district || "Local Desconhecido",
            postalCode: senderZip || "1000-001",
            address: s.sender_address || `${originCoord.name}, Portugal`,
            departureTime: s.created_at ? new Date(s.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }) : "09:00",
            lat: originCoord.lat,
            lng: originCoord.lng
          },
          destination: {
            hubName: s.recipient_name || `Destino: ${destCoord.name}`,
            city: s.recipient_city || destCoord.district || "Local Desconhecido",
            postalCode: recipientZip || "4000-001",
            address: s.recipient_address || `${destCoord.name}, Portugal`,
            eta: dynamicEta,
            etaDate: "Previsto",
            lat: destCoord.lat,
            lng: destCoord.lng
          },
          cargo: {
            weightStr: `${s.weight || 5} kg`,
            volumeStr: `${s.volume || 0.1} m³`,
            packagesCount: s.volumes || 1,
            category: s.goods_description || "Mercadoria Geral",
            clientName: s.sender_name || "Cliente Registado"
          },
          metrics: {
            totalDistanceKm: 260,
            remainingDistanceKm: Math.round(260 * (1 - progressPercent / 100)),
            remainingTimeStr: dynamicRemaining,
            lastPickagemLocation: pickagens.find(p => p.isCurrentPosition)?.locationName || originCoord.name,
            lastPickagemTime: pickagens.find(p => p.isCurrentPosition)?.formattedTime || "Agora",
            lastPickagemStatus: "Última Leitura Validada",
            progressPercent,
            completedScansCount: completedScans,
            totalScansCount: totalEstimatedScans
          },
          pickagens,
          documentation: {
            guiaNumber: s.reference || `GT-${s.id.slice(0, 8).toUpperCase()}`,
            atDocCode: `AT-${s.id.slice(0, 10).toUpperCase()}`,
            issueDate: new Date().toLocaleDateString("pt-PT"),
            senderName: s.sender_name || "Remetente",
            senderVat: "PT 999 999 990",
            senderAddress: s.sender_address || s.sender_city || "Portugal",
            recipientName: s.recipient_name || "Destinatário",
            recipientVat: "PT 999 999 991",
            recipientAddress: s.recipient_address || s.recipient_city || "Portugal",
            goodsDescription: s.goods_description || "Volumes de carga geral",
            cargoWeightKg: Number(s.weight) || 5,
            cargoPackages: s.volumes || 1,
            insuredValueEur: Number(s.sell_price) || 250
          }
        }
      }))
  } catch (err) {
    console.warn("Could not fetch real shipments for tracking screen:", err)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
            Tracking & Mapeamento por Pickagens
          </h1>
          <p className="text-xs text-[var(--text-tertiary)]">
            Itinerário rodoviário em mapa real traçado com base nas leituras dos centros de triagem e cais da transportadora.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <form className="flex items-center gap-2">
            {tabParam && <input type="hidden" name="tab" value={tabParam} />}
            <input
              type="text"
              name="search"
              defaultValue={searchQ}
              placeholder="Procurar envio (ex: LTK...)"
              className="text-xs px-3 py-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-primary)]"
            />
            <button type="submit" className="text-xs font-medium px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm">
              Buscar
            </button>
            {searchQ && (
              <Link href={`/ops/tracking?tab=${tabParam}`} className="text-xs font-medium px-3 py-1.5 rounded-md bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors ml-1">
                Limpar
              </Link>
            )}
          </form>

          <div className="flex items-center gap-1 bg-[var(--bg-secondary)] p-1 rounded-md border border-[var(--border-subtle)]">
            <Link
              href={`/ops/tracking?tab=active${searchQ ? `&search=${searchQ}` : ""}`}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${!isDeliveredTab
                  ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                }`}
            >
              Em Trânsito
            </Link>
            <Link
              href={`/ops/tracking?tab=entregues${searchQ ? `&search=${searchQ}` : ""}`}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${isDeliveredTab
                  ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                }`}
            >
              Entregues / Histórico
            </Link>
          </div>
        </div>
      </div>

      <DeliveryTrackingClient initialShipments={realShipmentsMapped} />
    </div>
  )
}
