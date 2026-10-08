"use client"

import React, { useEffect, useRef } from "react"
import { DestinationItem } from "./InteractiveEuropeHeatmap"

interface InteractiveLeafletHeatmapProps {
  destinations: DestinationItem[]
  activeCode: string
  setActiveCode: (code: string) => void
  hoveredCode: string | null
  setHoveredCode: (code: string | null) => void
}

export function InteractiveLeafletHeatmap({
  destinations,
  activeCode,
  setActiveCode,
  hoveredCode,
  setHoveredCode
}: InteractiveLeafletHeatmapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const layerGroupRef = useRef<any>(null)

  useEffect(() => {
    if (!mapContainerRef.current) return

    let isMounted = true

    import("leaflet").then((L) => {
      import("leaflet/dist/leaflet.css")

      if (!isMounted || !mapContainerRef.current) return

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          zoomControl: false,
          attributionControl: false,
        }).setView([46.2276, 2.2137], 4)

        // Dark theme map tiles
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          maxZoom: 19
        }).addTo(map)

        layerGroupRef.current = L.layerGroup().addTo(map)
        mapInstanceRef.current = map
      }

      const map = mapInstanceRef.current
      const layerGroup = layerGroupRef.current
      layerGroup.clearLayers()

      const portoCoords: [number, number] = [41.1579, -8.6291]

      // Main hub
      L.circleMarker(portoCoords, {
        radius: 8,
        fillColor: "#10b981",
        color: "#ffffff",
        weight: 2,
        fillOpacity: 0.8
      }).bindTooltip("<div class='font-bold text-slate-800'>Hub Central (Porto)</div>").addTo(layerGroup)

      destinations.forEach(dest => {
        const isSelected = dest.code === activeCode
        const isHovered = dest.code === hoveredCode
        const isActive = isSelected || isHovered

        let fillColor = "#94a3b8"
        if (dest.intensity === "muito_alto") fillColor = "#10b981"
        else if (dest.intensity === "alto") fillColor = "#3b82f6"
        else if (dest.intensity === "medio") fillColor = "#8b5cf6"

        if (isActive) {
          if (dest.intensity === "muito_alto") fillColor = "#059669"
          else if (dest.intensity === "alto") fillColor = "#2563eb"
          else if (dest.intensity === "medio") fillColor = "#7c3aed"
          else fillColor = "#64748b"
        }

        const destCoords: [number, number] = [dest.lat, dest.lng]

        if (dest.code !== "PT") {
          L.polyline([portoCoords, destCoords], {
            color: isActive ? "#38bdf8" : "#10b981",
            weight: isActive ? 2.5 : 1.2,
            dashArray: isActive ? undefined : "4, 4",
            opacity: isActive ? 1 : 0.4
          }).addTo(layerGroup)
        }

        const marker = L.circleMarker(destCoords, {
          radius: isSelected ? 16 : isHovered ? 14 : 10,
          fillColor,
          color: isSelected ? "#ffffff" : "#0f172a",
          weight: isSelected ? 2 : 1,
          fillOpacity: 0.8
        })

        const popupContent = `
          <div class="p-1 min-w-[120px]">
            <div class="font-bold text-slate-800 text-sm flex items-center gap-2">
              <span class="text-xl">${dest.flag}</span>
              ${dest.name}
            </div>
            <div class="text-xs text-slate-500 mt-1">Volume: ${dest.count} guias</div>
            <div class="text-xs text-slate-500">Tarifa Média: ${dest.avgCost.toFixed(2)} €</div>
          </div>
        `

        marker.bindPopup(popupContent, { closeButton: false })
        
        marker.on('click', () => {
          setActiveCode(dest.code)
          marker.openPopup()
        })
        marker.on('mouseover', () => setHoveredCode(dest.code))
        marker.on('mouseout', () => setHoveredCode(null))

        if (isSelected) {
          marker.openPopup()
        }

        marker.addTo(layerGroup)
      })

    })

    return () => {
      isMounted = false
    }
  }, [destinations, activeCode, hoveredCode])

  return (
    <div ref={mapContainerRef} className="w-full h-full absolute inset-0 rounded-2xl overflow-hidden z-0" />
  )
}
