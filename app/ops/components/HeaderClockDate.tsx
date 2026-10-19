"use client"

import React, { useEffect, useState } from "react"
import { ClockStef } from "./ClockStef"
import styles from "./HeaderClockDate.module.css"

export function HeaderClockDate() {
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState<Date | null>(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    setMounted(true)
    setNow(new Date())
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!showModal) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowModal(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [showModal])

  const currentDate = now || new Date()
  const hours = mounted ? String(currentDate.getHours()).padStart(2, "0") : "12"
  const minutes = mounted ? String(currentDate.getMinutes()).padStart(2, "0") : "00"
  const seconds = mounted ? String(currentDate.getSeconds()).padStart(2, "0") : "00"

  const weekdayRaw = mounted
    ? currentDate.toLocaleDateString("pt-PT", { weekday: "long" })
    : "Segunda-feira"
  const weekday = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1)

  const dayNumber = mounted ? currentDate.getDate() : 19
  const monthNameRaw = mounted
    ? currentDate.toLocaleDateString("pt-PT", { month: "long" })
    : "outubro"
  const monthName = monthNameRaw.charAt(0).toUpperCase() + monthNameRaw.slice(1)
  const year = mounted ? currentDate.getFullYear() : 2026

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className={styles.clockButton}
        title="Ver relógio de precisão Meridian"
        aria-label={`Hora atual: ${hours}:${minutes}:${seconds}. Data: ${weekday}, ${dayNumber} de ${monthName} de ${year}. Clique para abrir relógio completo.`}
      >
        <div className={styles.dialWrapper}>
          <ClockStef size="compact" />
        </div>

        <span className={styles.reading}>
          <span className={styles.timeRow} suppressHydrationWarning>
            <span>{hours}:{minutes}</span>
            <span className={styles.seconds}>:{seconds}</span>
            <span className={styles.liveDot} aria-hidden="true" />
          </span>

          <span className={styles.weekday} suppressHydrationWarning>
            {weekday}, {dayNumber}
          </span>

          <span className={styles.dateMonth} suppressHydrationWarning>
            {monthName} {year}
          </span>
        </span>
      </button>

      {/* Meridian Precision Clock Full Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setShowModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Relógio de precisão Meridian"
        >
          <div className="relative max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <ClockStef size="full" onClose={() => setShowModal(false)} showCloseButton />
          </div>
        </div>
      )}
    </>
  )
}
