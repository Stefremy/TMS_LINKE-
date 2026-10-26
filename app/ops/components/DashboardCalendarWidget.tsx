'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { isDateKey, lisbonDate } from '@/lib/billing/recurring-periods'
import utilityStyles from './FloatingCalculatorWidget.module.css'
import styles from './DashboardCalendarWidget.module.css'

type DaySummary = {
  date: string
  total: number | null
  event: { title: string; time: string | null } | null
  status: 'loading' | 'ready' | 'unavailable'
}

export function DashboardCalendarWidget({ initialDate }: { initialDate: string }) {
  const [summary, setSummary] = useState<DaySummary>({ date: initialDate, total: null, event: null, status: 'loading' })

  useEffect(() => {
    let active = true
    let inFlight = false
    async function refresh() {
      if (document.hidden || inFlight) return
      inFlight = true
      try {
        const response = await fetch('/api/calendar/today', { cache: 'no-store', signal: AbortSignal.timeout(15000) })
        if (!response.ok) throw new Error('Calendar unavailable')
        const data = await response.json()
        if (!isDateKey(data.date) || !Number.isSafeInteger(data.total) || data.total < 0) throw new Error('Invalid summary')
        if (active) setSummary({ date: data.date, total: data.total, event: data.event, status: 'ready' })
      } catch {
        if (active) setSummary({ date: lisbonDate(), total: null, event: null, status: 'unavailable' })
      } finally { inFlight = false }
    }
    void refresh()
    const onFocus = () => { void refresh() }
    const timer = window.setInterval(onFocus, 60000)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [])

  const date = new Date(`${summary.date}T12:00:00Z`)
  const month = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric', timeZone: 'Europe/Lisbon' }).format(date)
  const weekday = new Intl.DateTimeFormat('pt-PT', { weekday: 'short', timeZone: 'Europe/Lisbon' }).format(date)
  const day = summary.date.slice(-2)
  const status = summary.status === 'loading' ? 'A consultar eventos…'
    : summary.status === 'unavailable' ? 'Eventos indisponíveis'
    : summary.total === 0 ? 'Sem eventos hoje' : `${summary.total} ${summary.total === 1 ? 'evento hoje' : 'eventos hoje'}`
  const nextEvent = summary.event ? `${summary.event.time || 'Todo o dia'} · ${summary.event.title}` : 'Abrir calendário'

  return (
    <Link href="/ops/calendario" className={`${utilityStyles.button} ${styles.widget}`}
      title={`${day} de ${month}. ${status}${summary.event ? `. ${nextEvent}` : ''}`}
      aria-label={`Abrir calendário: ${day} de ${month}. ${status}${summary.event ? `. ${nextEvent}` : ''}`}>
      <span className={styles.dateBadge} aria-hidden="true">
        <span className={styles.weekday}>{weekday.replace('.', '').slice(0, 3)}</span>
        <span className={styles.day}>{day}</span>
      </span>
      <span className={styles.reading}>
        <span className={styles.month}>{month}</span>
        <span className={styles.status} aria-live="polite">
          {summary.status === 'ready' && (summary.total || 0) > 0 && <span className={styles.dot} aria-hidden="true" />}
          {status}
        </span>
        <span className={styles.event}>{nextEvent}</span>
      </span>
    </Link>
  )
}
