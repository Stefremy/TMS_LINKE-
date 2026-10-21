import React from "react"
import { Metadata } from "next"
import Link from "next/link"
import { requirePortalStore } from "@/lib/client-portal/access"
import { getShipmentsAction } from "@/app/actions/shipments"
import { createAdminClient } from "@/lib/supabase/server"
import { resolveCoordinates } from "@/lib/services/geo/geocoder"
import { TrackingShipment } from "@/app/ops/tracking/types"
import { buildTrackingCheckpoints } from "@/app/ops/tracking/checkpoints"
import { DeliveryTrackingClient } from "@/app/ops/tracking/components/DeliveryTrackingClient"

export const metadata: Metadata = {
  title: "Rastreio & Mapeamento | Área do Cliente",
  description: "Acompanhe em tempo real a geolocalização e as pickagens dos seus envios.",
}

export default async function ClientTrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeSlug: string }>
  searchParams?: Promise<{ tab?: string; search?: string }>
}) {
  const store = await requirePortalStore((await params).storeSlug)
  const { client, basePath } = store
  const supabase = createAdminClient()

  const resolvedSearchParams = await searchParams
  const tabParam = resolvedSearchParams?.tab || "active"
  const searchQ = (resolvedSearchParams?.search || "").trim()
  const isDeliveredTab = tabParam === "entregues"

  let realShipmentsMapped: TrackingShipment[] = []

  try {
    // Strictly fetch ONLY this client's own shipments
    const allFetched = await getShipmentsAction({ includeLabels: false, clientId: client.id })
    const clientOnlyShipments = (allFetched || []).filter((s: any) => s.client_id === client.id)

    const activeShipments = clientOnlyShipments.filter((s: any) => {
      if (searchQ) {
        const match =
          s.tracking_number?.toLowerCase().includes(searchQ.toLowerCase()) ||
          s.reference?.toLowerCase().includes(searchQ.toLowerCase()) ||
          s.recipient_name?.toLowerCase().includes(searchQ.toLowerCase())
        return match
      }
      if (isDeliveredTab) {
        return s.status === "entregue" || s.status === "devolvido"
      }
      return (
        s.status === "em_transito" ||
        s.status === "em transito" ||
        s.status === "em_distribuicao" ||
        s.status === "pendente"
      )
    }).slice(0, searchQ ? 50 : 25)

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

        // Resolve origin + destination coordinates
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
        const isCorreos =
          s.carrier_code === "correos" ||
          s.carrier_name?.toLowerCase().includes("correos") ||
          s.provider === "correos_express"

        const pickagens = await buildTrackingCheckpoints(dbEvts, {
          destination: destCoord,
          delivered: ["entregue", "devolvido", "entregue_pudo"].includes(s.status),
          country: isCorreos ? "" : "PT",
        })

        const completedScans = pickagens.filter((p) => p.status === "completed" || p.status === "current").length
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

        let dynamicEta = "Hoje, até 19:00"
        let dynamicRemaining = "A calcular..."

        if (isEntregue) {
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
          status: isEntregue ? "departed" : isArriving ? "arriving" : "active",
          rawStatus: s.status,
          statusLabel: isArriving ? "A Chegar" : "Em Trânsito",
          carrier: finalCarrier,
          serviceType: finalServiceType,
          isRealData: true,
          origin: {
            hubName: s.sender_name || `Origem: ${originCoord.name}`,
            city: s.sender_city || originCoord.name || "Origem",
            postalCode: senderZip || "1000-001",
            address: s.sender_address || `${originCoord.name}, Portugal`,
            departureTime: s.created_at
              ? new Date(s.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
              : "09:00",
            lat: originCoord.lat,
            lng: originCoord.lng,
          },
          destination: {
            hubName: s.recipient_name || `Destino: ${destCoord.name}`,
            city: s.recipient_city || destCoord.district || "Destino",
            postalCode: recipientZip || "4000-001",
            address: s.recipient_address || `${destCoord.name}, Portugal`,
            eta: dynamicEta,
            etaDate: "Previsto",
            lat: destCoord.lat,
            lng: destCoord.lng,
          },
          cargo: {
            weightStr: `${s.weight || 1} kg`,
            volumeStr: `${s.volume || 0.05} m³`,
            packagesCount: s.volumes || 1,
            category: s.goods_description || "Mercadoria Geral",
            clientName: client.short_name || client.legal_name || "Cliente",
          },
          metrics: {
            totalDistanceKm: 260,
            remainingDistanceKm: Math.round(260 * (1 - progressPercent / 100)),
            remainingTimeStr: dynamicRemaining,
            lastPickagemLocation: pickagens.find((p) => p.isCurrentPosition)?.locationName || originCoord.name,
            lastPickagemTime: pickagens.find((p) => p.isCurrentPosition)?.formattedTime || "Hoje",
            lastPickagemStatus: "Última Leitura Validada",
            progressPercent,
            completedScansCount: completedScans,
            totalScansCount: totalEstimatedScans,
          },
          pickagens,
          documentation: {
            guiaNumber: s.reference || `GT-${s.id.slice(0, 8).toUpperCase()}`,
            atDocCode: `AT-${s.id.slice(0, 10).toUpperCase()}`,
            issueDate: new Date().toLocaleDateString("pt-PT"),
            senderName: s.sender_name || client.legal_name || client.short_name || "Remetente",
            senderVat: client.nif || "Consulte Fatura",
            senderAddress: s.sender_address || s.sender_city || "Portugal",
            recipientName: s.recipient_name || "Destinatário",
            recipientVat: "Consumidor Final",
            recipientAddress: s.recipient_address || s.recipient_city || "Portugal",
            goodsDescription: s.goods_description || "Volumes de mercadoria geral",
            cargoWeightKg: Number(s.weight) || 1,
            cargoPackages: s.volumes || 1,
            insuredValueEur: Number(s.sell_price) || 50,
          },
        }
      })
    )
  } catch (err) {
    console.warn("Could not fetch shipments for client tracking:", err)
  }

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-[1600px] mx-auto">
      {/* Header com Navegação e Filtros */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-tertiary)] mb-1">
            <Link href={basePath} className="hover:text-[var(--accent)] transition-colors">
              Painel Principal
            </Link>
            <span>&gt;</span>
            <span className="text-[var(--accent)] font-bold">Rastreio & Mapa</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            Rastreio & Mapeamento por Pickagens
          </h1>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            Visualize em tempo real no mapa o trajeto e as passagens em hubs logísticos das suas encomendas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Formulário de Busca */}
          <form className="flex items-center gap-2">
            {tabParam && <input type="hidden" name="tab" value={tabParam} />}
            <input
              type="text"
              name="search"
              defaultValue={searchQ}
              placeholder="Pesquisar guia ou destinatário..."
              className="text-xs px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] w-52 sm:w-64"
            />
            <button
              type="submit"
              className="text-xs font-bold px-3 py-2 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-all shadow-xs cursor-pointer"
            >
              Pesquisar
            </button>
            {searchQ && (
              <Link
                href={`${basePath}/tracking?tab=${tabParam}`}
                className="text-xs font-medium px-2.5 py-2 rounded-lg bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-dim)] transition-colors"
              >
                Limpar
              </Link>
            )}
          </form>

          {/* Alternador de Separadores */}
          <div className="flex items-center gap-1 bg-[var(--surface-muted)] p-1 rounded-lg border border-[var(--border-subtle)]">
            <Link
              href={`${basePath}/tracking?tab=active${searchQ ? `&search=${encodeURIComponent(searchQ)}` : ""}`}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                !isDeliveredTab
                  ? "bg-[var(--surface-bg)] text-[var(--accent)] shadow-xs"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Em Trânsito
            </Link>
            <Link
              href={`${basePath}/tracking?tab=entregues${searchQ ? `&search=${encodeURIComponent(searchQ)}` : ""}`}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                isDeliveredTab
                  ? "bg-[var(--surface-bg)] text-[var(--accent)] shadow-xs"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Entregues / Histórico
            </Link>
          </div>
        </div>
      </div>

      {/* Componente Leaflet Interativo com Itinerários & Checkpoints */}
      <DeliveryTrackingClient
        initialShipments={realShipmentsMapped}
        isClientPortal={true}
        baseTrackingPath={`${basePath}/tracking`}
        clientName={client.short_name || client.legal_name || "Cliente"}
        newShipmentHref={`${basePath}/criar-guia`}
      />
    </div>
  )
}
