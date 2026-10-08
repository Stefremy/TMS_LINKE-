"use client"

import React, { useEffect, useState } from "react"
import { Clock as ClockIcon, X, Maximize2, Minimize2 } from "lucide-react"

interface ClockStefProps {
  size?: "compact" | "full"
  onClose?: () => void
  showCloseButton?: boolean
}

export function ClockStef({ size = "full", onClose, showCloseButton = false }: ClockStefProps) {
  const [time, setTime] = useState<Date | null>(null)
  const [use24Hour, setUse24Hour] = useState(false)

  useEffect(() => {
    setTime(new Date())
    const interval = setInterval(() => {
      setTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Use null-safe values: render static hands on server (time is null until useEffect)
  const seconds = time ? time.getSeconds() : 0
  const minutes = time ? time.getMinutes() : 0
  const hours = time ? time.getHours() : 0
  const milliseconds = time ? time.getMilliseconds() : 0
  const now = time || new Date(0)

  // Smooth or discrete second angle
  const secondDegrees = (seconds / 60) * 360
  const minuteDegrees = ((minutes + seconds / 60) / 60) * 360
  const hourDegrees = (((hours % 12) + minutes / 60 + seconds / 3600) / 12) * 360

  // Digital time formatting
  const displayHours = use24Hour ? hours : (hours % 12 || 12)
  const ampm = hours >= 12 ? "PM" : "AM"
  const formattedHours = String(displayHours).padStart(2, "0")
  const formattedMinutes = String(minutes).padStart(2, "0")
  const formattedSeconds = String(seconds).padStart(2, "0")

  // Date formatting (English as in the Figma Meridian mockup, or localized)
  const dayName = now.toLocaleDateString("pt-PT", { weekday: "long" })
  const dayNumber = now.getDate()
  const monthName = now.toLocaleDateString("pt-PT", { month: "long" })
  const year = now.getFullYear()
  const dateString = `${dayName}, ${dayNumber} ${monthName} ${year}`

  // UTC offset
  const offsetMinutes = -now.getTimezoneOffset()
  const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60)
  const offsetMinsRemainder = Math.abs(offsetMinutes) % 60
  const offsetSign = offsetMinutes >= 0 ? "+" : "-"
  const formattedOffset = `UTC ${offsetSign}${String(offsetHours).padStart(2, "0")}:${String(offsetMinsRemainder).padStart(2, "0")}`

  // Dial SVG geometry
  const center = 150
  const radius = 125
  const numberRadius = 96

  // Generate 60 ticks
  const ticks = Array.from({ length: 60 }).map((_, i) => {
    const isHour = i % 5 === 0
    const angle = (i * 6 - 90) * (Math.PI / 180)
    const tickLen = isHour ? 12 : 6
    const rOuter = radius
    const rInner = radius - tickLen

    return {
      index: i,
      isHour,
      x1: center + rInner * Math.cos(angle),
      y1: center + rInner * Math.sin(angle),
      x2: center + rOuter * Math.cos(angle),
      y2: center + rOuter * Math.sin(angle),
      strokeWidth: isHour ? 1.8 : 0.9,
      strokeColor: isHour ? "#64748b" : "#cbd5e1"
    }
  })

  // Generate 12 numerals
  const numerals = Array.from({ length: 12 }).map((_, i) => {
    const hourNum = i + 1
    const angle = (hourNum * 30 - 90) * (Math.PI / 180)
    return {
      num: hourNum,
      x: center + numberRadius * Math.cos(angle),
      y: center + numberRadius * Math.sin(angle)
    }
  })

  if (size === "compact") {
    return (
      <div className="relative w-9 h-9 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0 cursor-pointer overflow-hidden transition-all hover:scale-105 hover:shadow-md">
        <svg viewBox="0 0 100 100" className="w-full h-full p-0.5">
          {/* Subtle perimeter */}
          <circle cx="50" cy="50" r="46" fill="transparent" stroke="#e2e8f0" strokeWidth="0.8"  />
          
          {/* Main 4 hour ticks (12, 3, 6, 9) */}
          <line x1="50" y1="6" x2="50" y2="12" stroke="#475569" strokeWidth="1.5" strokeLinecap="round"  />
          <line x1="94" y1="50" x2="88" y2="50" stroke="#475569" strokeWidth="1.5" strokeLinecap="round"  />
          <line x1="50" y1="94" x2="50" y2="88" stroke="#475569" strokeWidth="1.5" strokeLinecap="round"  />
          <line x1="6" y1="50" x2="12" y2="50" stroke="#475569" strokeWidth="1.5" strokeLinecap="round"  />

          {/* Hour hand */}
          <line 
            x1="50" 
            y1="50" 
            x2="50" 
            y2="28" 
            stroke="#0f172a" 
            strokeWidth="2.2" 
            strokeLinecap="round"
            suppressHydrationWarning
            transform={`rotate(${hourDegrees} 50 50)`} 
          />
          {/* Minute hand */}
          <line 
            x1="50" 
            y1="50" 
            x2="50" 
            y2="18" 
            stroke="#334155" 
            strokeWidth="1.6" 
            strokeLinecap="round"
            suppressHydrationWarning
            transform={`rotate(${minuteDegrees} 50 50)`} 
          />
          {/* Second hand needle */}
          <line 
            x1="50" 
            y1="56" 
            x2="50" 
            y2="14" 
            stroke="#10b981" 
            strokeWidth="0.9" 
            suppressHydrationWarning
            transform={`rotate(${secondDegrees} 50 50)`} 
          />
          {/* Center cap */}
          <circle cx="50" cy="50" r="2.2" fill="#0f172a"  />
        </svg>
      </div>
    )
  }

  return (
    <div className="relative w-full max-w-[420px] mx-auto bg-[#FAFAFB] text-[#111827] rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.08)] _20px_50px_rgba(0,0,0,0.5)] border border-slate-200/80 select-none">
      {/* Top Header matching Figma mockup */}
      <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-slate-400 mb-2">
        <span className="uppercase tracking-[0.2em] text-slate-800 font-bold">
          MERIDIAN
        </span>
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => setUse24Hour(!use24Hour)}
            className="uppercase tracking-[0.15em] hover:text-slate-900 transition-colors cursor-pointer"
            title="Alternar formato 12h/24h"
          >
            {use24Hour ? "24H FORMAT" : "ANALOG / DIGITAL"}
          </button>
          {showCloseButton && onClose && (
            <button 
              type="button" 
              onClick={onClose}
              className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sub-header Location */}
      <div className="text-center text-[10px] tracking-[0.25em] font-medium text-slate-400 uppercase mb-5">
        • LOCAL TIME • LISBOA •
      </div>

      {/* The Meridian Clock Face */}
      <div className="relative flex items-center justify-center my-3">
        {/* Soft background glow / watch dial disk */}
        <div className="relative w-[280px] h-[280px] sm:w-[300px] sm:h-[300px] rounded-full bg-white shadow-[0_16px_40px_-10px_rgba(0,0,0,0.09),0_2px_10px_rgba(0,0,0,0.03)] _16px_40px_-10px_rgba(0,0,0,0.6)] flex items-center justify-center border border-slate-100">
          <svg viewBox="0 0 300 300" className="w-full h-full select-none">
            {/* Minute & Hour Ticks */}
            {ticks.map((t) => (
              <line
                key={t.index}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={t.strokeColor}
                strokeWidth={t.strokeWidth}
                strokeLinecap="round"
                className={t.isHour ? "" : ""}
              />
            ))}

            {/* Numerals 1 to 12 */}
            {numerals.map((num) => (
              <text
                key={num.num}
                x={num.x}
                y={num.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#334155"
                className="font-sans"
                style={{ fontSize: "14px", fontWeight: "400" }}
              >
                {num.num}
              </text>
            ))}

            {/* Brand text above and below center */}
            <text
              x={center}
              y={center - 45}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#64748b"
              className="font-sans uppercase"
              style={{ fontSize: "8px", fontWeight: "600", letterSpacing: "2.5px" }}
            >
              MERIDIAN
            </text>
            <text
              x={center}
              y={center + 50}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#94a3b8"
              className="font-sans uppercase"
              style={{ fontSize: "6.5px", fontWeight: "500", letterSpacing: "2px" }}
            >
              PRECISION TIME
            </text>

            {/* Hour Hand */}
            <line
              x1={center}
              y1={center}
              x2={center}
              y2={center - 64}
              stroke="#0f172a"
              strokeWidth="3.6"
              strokeLinecap="round"
              
              transform={`rotate(${hourDegrees} ${center} ${center})`}
            />

            {/* Minute Hand */}
            <line
              x1={center}
              y1={center}
              x2={center}
              y2={center - 98}
              stroke="#0f172a"
              strokeWidth="2.5"
              strokeLinecap="round"
              
              transform={`rotate(${minuteDegrees} ${center} ${center})`}
            />

            {/* Second Hand Needle + Counter-tail */}
            <g transform={`rotate(${secondDegrees} ${center} ${center})`}>
              <line
                x1={center}
                y1={center + 24}
                x2={center}
                y2={center - 118}
                stroke="#0f172a"
                strokeWidth="0.9"
                
              />
              {/* Counter-weight circle */}
              <circle
                cx={center}
                cy={center + 14}
                r="2.5"
                fill="#0f172a"
                
              />
            </g>

            {/* Center Cap Pin */}
            <circle cx={center} cy={center} r="4.5" fill="#0f172a"  />
            <circle cx={center} cy={center} r="1.5" fill="#64748b"  />
          </svg>
        </div>
      </div>

      {/* Digital Time Readout below matching Figma */}
      <div className="text-center mt-5">
        <div className="flex items-baseline justify-center gap-1 font-mono tracking-tight text-[#0f172a]">
          <span className="text-4xl sm:text-5xl font-light">
            {formattedHours}:{formattedMinutes}
          </span>
          <span className="text-2xl sm:text-3xl font-light text-slate-400">
            :{formattedSeconds}
          </span>
          {!use24Hour && (
            <span className="text-xs font-semibold uppercase text-slate-400 ml-1">
              {ampm}
            </span>
          )}
        </div>
        
        {/* Date underneath */}
        <p className="text-xs sm:text-sm font-normal text-slate-500 mt-2">
          {dateString}
        </p>
      </div>

      {/* Subtle Footer with Timezone info */}
      <div className="mt-8 pt-4 border-t border-slate-200/60 flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400 font-medium">
        <span>WESTERN EUROPEAN TIME</span>
        <div className="w-12 h-px bg-slate-200" />
        <span>{formattedOffset}</span>
      </div>
    </div>
  )
}
