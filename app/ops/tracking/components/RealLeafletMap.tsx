"use client"

import React, { useEffect, useRef, useState } from "react"
import { TrackingShipment, ShipmentPickagem } from "../types"
import "leaflet/dist/leaflet.css"
import { 
  Layers, 
  Crosshair, 
  MapPin, 
  FileText, 
  Maximize2, 
  Info,
  Clock,
  ScanLine,
  Navigation
} from "lucide-react"

interface RealLeafletMapProps {
  shipment: TrackingShipment
  onOpenDocumentation: () => void
}

export function RealLeafletMap({ shipment, onOpenDocumentation }: RealLeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const layerGroupRef = useRef<any>(null)
  const tileLayerRef = useRef<any>(null)

  const [mapStyle, setMapStyle] = useState<"streets" | "satellite">("streets")
  const [selectedPickagem, setSelectedPickagem] = useState<ShipmentPickagem | null>(null)

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current) return

    let isMounted = true

    // Dynamically import Leaflet so it only runs on the client
    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current) return

      // If map already exists, just remove it first to avoid duplicate init
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }

      // Default center: Central Portugal (Leiria / Coimbra)
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([39.6, -8.6], 7)

      // Add attribution in compact corner
      L.control.attribution({ position: "bottomright", prefix: "© OpenStreetMap contributors" }).addTo(map)

      // Tile layer
      const streetTiles = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { maxZoom: 19 }
      )
      streetTiles.addTo(map)
      tileLayerRef.current = streetTiles

      // Layer group for route polylines and pickagem markers
      const layerGroup = L.layerGroup().addTo(map)
      layerGroupRef.current = layerGroup
      mapInstanceRef.current = map

      // Render the current shipment markers & route
      renderShipmentRoute(L, map, layerGroup, shipment)
    })

    return () => {
      isMounted = false
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Update map style (Streets vs Satellite)
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return

    import("leaflet").then((L) => {
      if (tileLayerRef.current) {
        mapInstanceRef.current.removeLayer(tileLayerRef.current)
      }

      let newTileLayer
      if (mapStyle === "satellite") {
        newTileLayer = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 18 }
        )
      } else {
        newTileLayer = L.tileLayer(
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          { maxZoom: 19 }
        )
      }
      newTileLayer.addTo(mapInstanceRef.current)
      tileLayerRef.current = newTileLayer
    })
  }, [mapStyle])

  // Re-render route whenever the selected shipment changes
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return

    import("leaflet").then((L) => {
      renderShipmentRoute(L, mapInstanceRef.current, layerGroupRef.current, shipment)
    })
  }, [shipment])

  const renderShipmentRoute = (
    L: any,
    map: any,
    layerGroup: any,
    targetShipment: TrackingShipment
  ) => {
    layerGroup.clearLayers()

    const pickagens = targetShipment.pickagens || []
    
    // Combine origin, pickagens, and destination into one continuous path
    const pathNodes: any[] = []
    
    // 1. Origin
    pathNodes.push({
      lat: targetShipment.origin.lat,
      lng: targetShipment.origin.lng,
      isOrigin: true,
      status: pickagens.length > 0 ? "completed" : "pending"
    })
    
    // 2. Pickagens
    pickagens.forEach(p => {
      pathNodes.push({
        lat: p.lat,
        lng: p.lng,
        isPickagem: true,
        status: p.status,
        pickagemData: p
      })
    })
    
    // 3. Destination
    pathNodes.push({
      lat: targetShipment.destination.lat,
      lng: targetShipment.destination.lng,
      isDestination: true,
      status: targetShipment.status === "delivered" ? "completed" : "pending"
    })

    const latLngs = pathNodes.map((n) => [n.lat, n.lng])

    // Draw full dashed path (Background)
    L.polyline(latLngs, {
      color: "#94a3b8",
      weight: 3,
      dashArray: "8, 8",
      opacity: 0.8,
      lineCap: "round",
    }).addTo(layerGroup)

    // Draw solid completed path (if any)
    const completedNodes = pathNodes.filter((n) => n.status === "completed" || n.status === "current")
    if (completedNodes.length >= 1) {
      // If we only have 1 completed node (e.g. Origin), it doesn't draw a line, which is fine.
      if (completedNodes.length >= 2) {
        const completedLatLngs = completedNodes.map((n) => [n.lat, n.lng])
        // Outer glow
        L.polyline(completedLatLngs, {
          color: "#18A957",
          weight: 8,
          opacity: 0.35,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(layerGroup)

        // Solid road line
        L.polyline(completedLatLngs, {
          color: "#128A47",
          weight: 4,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(layerGroup)
      }
    }

    // 3. Create Custom HTML Marker Pins for each node
    pathNodes.forEach((n) => {
      const isOrigin = n.isOrigin
      const isDestination = n.isDestination
      const p = n.pickagemData
      const isCurrent = p?.isCurrentPosition || n.status === "current"

      let pinHtml = ""
      if (isCurrent && p) {
        pinHtml = `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-8 h-8 rounded-full bg-emerald-500/30 animate-ping"></span>
            <span class="absolute w-6 h-6 rounded-full bg-emerald-500/50"></span>
            <div class="relative z-10 w-6 h-6 rounded-full bg-emerald-600 border-2 border-white shadow-lg flex items-center justify-center text-white">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div class="absolute -top-7 left-1/2 -translate-x-1/2 bg-emerald-700 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">
              ${p.formattedTime} • ÚLTIMA PICKAGEM
            </div>
          </div>
        `
      } else if (isOrigin) {
        pinHtml = `
          <div class="relative flex items-center justify-center">
            <div class="w-5 h-5 rounded-full bg-slate-700 border-2 border-white shadow-md flex items-center justify-center text-white">
              <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
            </div>
            <div class="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] font-bold px-1.5 py-0.2 rounded shadow whitespace-nowrap">
              RECOLHA / ORIGEM
            </div>
          </div>
        `
      } else if (isDestination) {
        pinHtml = `
          <div class="relative flex items-center justify-center">
            <div class="w-5 h-5 rounded-full bg-rose-600 border-2 border-white shadow-md flex items-center justify-center text-white">
              <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
            </div>
            <div class="absolute -top-6 left-1/2 -translate-x-1/2 bg-rose-800 text-white text-[9px] font-bold px-1.5 py-0.2 rounded shadow whitespace-nowrap">
              DESTINO
            </div>
          </div>
        `
      } else {
        pinHtml = `
          <div class="relative flex items-center justify-center">
            <div class="w-4 h-4 rounded-full ${n.status === "completed" ? "bg-emerald-600" : "bg-slate-400"} border-2 border-white shadow-sm flex items-center justify-center">
              <span class="w-1 h-1 rounded-full bg-white"></span>
            </div>
          </div>
        `
      }

      const customIcon = L.divIcon({
        className: "custom-pickagem-pin",
        html: pinHtml,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })

      const marker = L.marker([n.lat, n.lng], { icon: customIcon }).addTo(layerGroup)

      if (p) {
        // Rich popup content on marker click
        const popupHtml = `
          <div style="font-family: inherit; min-width: 190px; padding: 2px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-size: 10px; font-weight: 700; color: #128A47; text-transform: uppercase;">
                [${p.code}] ${p.title}
              </span>
              <span style="font-size: 10px; font-family: monospace; color: #64748b;">
                ${p.formattedTime}
              </span>
            </div>
            <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
              ${p.locationName}
            </div>
            <div style="font-size: 10px; color: #475569;">
              ${p.city} ${p.postalCode ? `(${p.postalCode})` : ""}
            </div>
            ${p.scannerDevice ? `
              <div style="font-size: 9px; color: #94a3b8; margin-top: 4px; border-top: 1px solid #e2e8f0; padding-top: 4px;">
                Ponto de Leitura: ${p.scannerDevice}
              </div>
            ` : ""}
          </div>
        `
        marker.bindPopup(popupHtml)
        marker.on("click", () => setSelectedPickagem(p))
      } else {
        marker.bindPopup(`<div style="font-family: inherit; font-size: 12px; font-weight: 700;">${isOrigin ? targetShipment.origin.hubName : targetShipment.destination.hubName}</div>`)
      }
    })

    // Fit map bounds to encompass all nodes smoothly
    try {
      const bounds = L.latLngBounds(latLngs)
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13, animate: true })
    } catch (e) {
      // Ignore boundary errors
    }
  }

  const handleCenterOnLastPickagem = () => {
    if (!mapInstanceRef.current) return
    const current = shipment.pickagens.find((p) => p.isCurrentPosition || p.status === "current")
    if (current) {
      mapInstanceRef.current.flyTo([current.lat, current.lng], 12, { animate: true, duration: 1.2 })
    }
  }

  const handleFitAllRoute = () => {
    if (!mapInstanceRef.current || shipment.pickagens.length === 0) return
    import("leaflet").then((L) => {
      const bounds = L.latLngBounds(shipment.pickagens.map((p) => [p.lat, p.lng]))
      mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 13, animate: true })
    })
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] overflow-hidden shadow-xs">
      {/* Top Header Bar */}
      <div className="p-4 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 bg-[var(--surface-bg)]">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2.5">
            <h2 className="font-mono text-lg font-bold text-[var(--text-primary)] tracking-tight">
              {shipment.displayId}
            </h2>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-[var(--surface-bg)] text-emerald-600 border border-[var(--border-strong)] shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {shipment.statusLabel}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-[var(--text-primary)] bg-[var(--surface-muted)] px-3 py-1 rounded-full border border-[var(--border-strong)] shadow-2xs">
              <ScanLine className="w-3.5 h-3.5 text-emerald-600" />
              {shipment.metrics.completedScansCount} de {shipment.metrics.totalScansCount} Pickagens Registadas
            </span>
          </div>
          <p className="text-xs text-[var(--text-tertiary)] truncate">
            {shipment.origin.hubName} <span className="text-emerald-500 font-semibold">→</span> {shipment.destination.hubName}
          </p>
        </div>

        {/* Action Button: Documentation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenDocumentation}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-xs hover:shadow-md cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Documentação</span>
          </button>
        </div>
      </div>

      {/* Real Map Canvas Container */}
      <div className="relative flex-1 min-h-[380px] lg:min-h-[480px] bg-slate-100 dark:bg-slate-950">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-10" />

        {/* Map Floating Layer Switcher */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMapStyle(mapStyle === "streets" ? "satellite" : "streets")}
            className="bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] border border-[var(--border-strong)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] flex items-center gap-2 shadow-md transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            <span>{mapStyle === "streets" ? "Vista Satélite" : "Vista Ruas"}</span>
          </button>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--surface-bg)] border border-[var(--border-strong)] text-[11px] text-[var(--text-secondary)] shadow-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Última Pickagem: <strong className="text-[var(--text-primary)] font-bold">{shipment.metrics.lastPickagemLocation}</strong></span>
          </div>
        </div>

        {/* Map Quick Navigation Controls */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={handleFitAllRoute}
            className="w-8 h-8 rounded-lg bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] text-emerald-600 border border-[var(--border-strong)] flex items-center justify-center shadow-md transition-colors"
            title="Ajustar rota completa no mapa"
          >
            <Navigation className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleCenterOnLastPickagem}
            className="w-8 h-8 rounded-lg bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] text-emerald-600 border border-[var(--border-strong)] flex items-center justify-center shadow-md transition-colors"
            title="Centrar na última pickagem"
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
