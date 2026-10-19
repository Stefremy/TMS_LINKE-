"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Bell, BellRing, ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { User as SupabaseUser } from "@supabase/supabase-js"

import { getColaboradoresAction } from "@/app/actions/colaboradores"
import styles from "./TeamCalendar.module.css"

const PALETTE = [
  { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", dot: "bg-blue-500" },
  { color: "bg-pink-500/20 text-pink-400 border-pink-500/30", dot: "bg-pink-500" },
  { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", dot: "bg-amber-500" },
  { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500" },
  { color: "bg-purple-500/20 text-purple-400 border-purple-500/30", dot: "bg-purple-500" },
  { color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30", dot: "bg-cyan-500" },
  { color: "bg-rose-500/20 text-rose-400 border-rose-500/30", dot: "bg-rose-500" },
  { color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30", dot: "bg-indigo-500" },
]

type CalendarEvent = { 
  id: string | number, 
  date: number, 
  title: string, 
  description?: string,
  time?: string,
  collabId: string, 
  creatorEmail?: string,
  month: number, 
  year: number 
}
type CalendarEventRow = {
  id: string | number
  event_date: string
  title: string
  description?: string | null
  time?: string | null
  collab_id: string
  creator_email?: string | null
}
type CalendarCollaborator = { id: string; name: string; email: string; color: string; dot: string }

// Helper to calculate Easter date for a given year
function getEasterDate(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month, day)
}

export interface CalendarHoliday {
  date: number
  month: number
  title: string
  country: "PT" | "ES"
}

// Minimal vector flag indicator (clean, subtle, non-AI)
function MinimalFlag({ country }: { country: "PT" | "ES" }) {
  if (country === "PT") {
    return (
      <span 
        aria-hidden="true"
        className="inline-flex items-stretch w-3.5 h-2.5 rounded-[2px] overflow-hidden border border-black/20 dark:border-white/20 shrink-0 shadow-2xs"
      >
        <span className="w-[40%] h-full bg-[#006600]" />
        <span className="w-[60%] h-full bg-[#d00000]" />
      </span>
    )
  }
  return (
    <span 
      aria-hidden="true"
      className="inline-flex flex-col items-stretch w-3.5 h-2.5 rounded-[2px] overflow-hidden border border-black/20 dark:border-white/20 shrink-0 shadow-2xs"
    >
      <span className="w-full h-[28%] bg-[#aa151b]" />
      <span className="w-full h-[44%] bg-[#f1bf00]" />
      <span className="w-full h-[28%] bg-[#aa151b]" />
    </span>
  )
}

// Calculate Portuguese national holidays
function getPortugueseHolidays(year: number): CalendarHoliday[] {
  const holidays: CalendarHoliday[] = [
    { date: 1, month: 0, title: "Ano Novo", country: "PT" },
    { date: 25, month: 3, title: "Dia da Liberdade", country: "PT" },
    { date: 1, month: 4, title: "Dia do Trabalhador", country: "PT" },
    { date: 10, month: 5, title: "Dia de Portugal", country: "PT" },
    { date: 15, month: 7, title: "Assunção de N. Sra.", country: "PT" },
    { date: 5, month: 9, title: "Implantação da República", country: "PT" },
    { date: 1, month: 10, title: "Todos os Santos", country: "PT" },
    { date: 1, month: 11, title: "Restauração da Indep.", country: "PT" },
    { date: 8, month: 11, title: "Imaculada Conceição", country: "PT" },
    { date: 25, month: 11, title: "Natal", country: "PT" }
  ]

  const easterDate = getEasterDate(year)
  holidays.push({ date: easterDate.getDate(), month: easterDate.getMonth(), title: "Páscoa", country: "PT" })

  const goodFriday = new Date(easterDate.getTime() - 2 * 24 * 60 * 60 * 1000)
  holidays.push({ date: goodFriday.getDate(), month: goodFriday.getMonth(), title: "Sexta-feira Santa", country: "PT" })

  const corpusChristi = new Date(easterDate.getTime() + 60 * 24 * 60 * 60 * 1000)
  holidays.push({ date: corpusChristi.getDate(), month: corpusChristi.getMonth(), title: "Corpo de Deus", country: "PT" })

  const carnaval = new Date(easterDate.getTime() - 47 * 24 * 60 * 60 * 1000)
  holidays.push({ date: carnaval.getDate(), month: carnaval.getMonth(), title: "Carnaval", country: "PT" })

  return holidays
}

// Calculate Spanish national & regional logistics-critical holidays
function getSpanishHolidays(year: number): CalendarHoliday[] {
  const holidays: CalendarHoliday[] = [
    { date: 1, month: 0, title: "Año Nuevo", country: "ES" },
    { date: 6, month: 0, title: "Día de Reyes (Epifanía)", country: "ES" },
    { date: 1, month: 4, title: "Fiesta del Trabajo", country: "ES" },
    { date: 15, month: 7, title: "Asunción de la Virgen", country: "ES" },
    { date: 12, month: 9, title: "Fiesta Nacional de España (Hispanidad)", country: "ES" },
    { date: 1, month: 10, title: "Todos los Santos", country: "ES" },
    { date: 6, month: 11, title: "Día de la Constitución", country: "ES" },
    { date: 8, month: 11, title: "Inmaculada Concepción", country: "ES" },
    { date: 25, month: 11, title: "Navidad", country: "ES" }
  ]

  const easterDate = getEasterDate(year)

  // Jueves Santo (Quinta-feira Santa) - Feriado em quase todas as comunidades espanholas
  const juevesSanto = new Date(easterDate.getTime() - 3 * 24 * 60 * 60 * 1000)
  holidays.push({ date: juevesSanto.getDate(), month: juevesSanto.getMonth(), title: "Jueves Santo", country: "ES" })

  // Viernes Santo (Sexta-feira Santa) - Feriado Nacional em Espanha
  const viernesSanto = new Date(easterDate.getTime() - 2 * 24 * 60 * 60 * 1000)
  holidays.push({ date: viernesSanto.getDate(), month: viernesSanto.getMonth(), title: "Viernes Santo", country: "ES" })

  // Lunes de Pascua (Segunda-feira de Páscoa - feriado em Catalunha, Valência, País Basco)
  const lunesPascua = new Date(easterDate.getTime() + 1 * 24 * 60 * 60 * 1000)
  holidays.push({ date: lunesPascua.getDate(), month: lunesPascua.getMonth(), title: "Lunes de Pascua (Hubs ES)", country: "ES" })

  return holidays
}

import { fetchCalendarEvents, addCalendarEvent } from "../../actions/calendar"

export function TeamCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate())
  const [formData, setFormData] = useState({ title: "", description: "", time: "09:00", endTime: "18:00", startDate: "", endDate: "", allDay: true, collabId: "" })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [collaborators, setCollaborators] = useState<CalendarCollaborator[]>([])
  const [showPtHolidays, setShowPtHolidays] = useState(true)
  const [showEsHolidays, setShowEsHolidays] = useState(true)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default")

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  useEffect(() => {
    async function loadColabs() {
      const dbColabs = await getColaboradoresAction()
      const mapped = dbColabs.map((c, i) => {
        const p = PALETTE[i % PALETTE.length]
        return {
          id: c.id,
          name: c.name.split(' ')[0], // first name only for compact view
          email: c.email,
          color: p.color,
          dot: p.dot
        }
      })
      setCollaborators(mapped)
    }
    loadColabs()
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUser(data.user)
    })
  }, [])

  // Fetch events from DB when month/year changes
  useEffect(() => {
    async function loadEvents() {
      setIsLoading(true)
      const data = await fetchCalendarEvents(year, month)
      if (data) {
        // Map db events to CalendarEvent
        const mapped: CalendarEvent[] = data.map((d: CalendarEventRow) => {
          const dateObj = new Date(`${d.event_date}T12:00:00`)
          return {
            id: d.id,
            date: dateObj.getDate(),
            month: dateObj.getMonth(),
            year: dateObj.getFullYear(),
            title: d.title,
            description: d.description || "",
            time: d.time || "",
            collabId: d.collab_id,
            creatorEmail: d.creator_email || undefined
          }
        })
        setEvents(mapped)
      }
      setIsLoading(false)
    }
    loadEvents()
  }, [year, month])

  // Notifications logic
  useEffect(() => {
    const checkNotifications = () => {
      const now = new Date()
      
      // Events 1 hour before
      events.forEach(e => {
        if (!e.time) return
        const startTime = e.time.match(/^(\d{2}):(\d{2})/)
        if (!startTime) return
        const [, hours, minutes] = startTime.map(Number)
        const eventTime = new Date(e.year, e.month, e.date, hours, minutes)
        const diffMins = Math.round((eventTime.getTime() - now.getTime()) / 60000)
        
        if (diffMins === 60) {
          if (Notification.permission === "granted") {
            new Notification("Evento em 1 hora!", {
              body: `${e.title}${e.description ? ' - ' + e.description : ''}`,
              icon: "/favicon.png"
            })
          }
        }
      })
      
      // Holidays 3 days before (Trigger at 10:00 AM)
      const allUpcoming = [...getPortugueseHolidays(now.getFullYear()), ...getSpanishHolidays(now.getFullYear())]
      allUpcoming.forEach(h => {
        const holidayTime = new Date(now.getFullYear(), h.month, h.date)
        const diffDays = Math.round((holidayTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        
        if (diffDays === 3 && now.getHours() === 10 && now.getMinutes() === 0) {
          if (Notification.permission === "granted") {
            new Notification(`Feriado a aproximar-se (${h.country === 'PT' ? 'Portugal 🇵🇹' : 'Espanha 🇪🇸'})!`, {
              body: `O feriado de ${h.title} é daqui a 3 dias. Verifique trânsito e expedições.`,
              icon: "/favicon.png"
            })
          }
        }
      })
    }
    
    const interval = setInterval(checkNotifications, 60000) // check every minute
    return () => clearInterval(interval)
  }, [events])

  const enableNotifications = async () => {
    if (!("Notification" in window)) return
    setNotificationPermission(await Notification.requestPermission())
  }

  const openAddEvent = (day?: number) => {
    const chosenDay = Math.min(day || new Date().getDate(), new Date(year, month + 1, 0).getDate())
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(chosenDay).padStart(2, "0")}`
    setSelectedDay(chosenDay)
    setFormData({ title: "", description: "", time: "09:00", endTime: "18:00", startDate: date, endDate: date, allDay: true, collabId: collaborators.find(c => c.email === user?.email)?.id || collaborators[0]?.id || "" })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title) return
    setIsSubmitting(true)
    
    try {
      const result = await addCalendarEvent({
        title: formData.title,
        description: formData.description,
        time: formData.time,
        event_date: formData.startDate,
        end_date: formData.endDate,
        end_time: formData.endTime,
        all_day: formData.allDay,
        collab_id: formData.collabId,
        creator_email: user?.email || "Admin Local"
      })

      if (result.success && result.data) {
        const newEvents: CalendarEvent[] = (result.events || [result.data]).map((d: CalendarEventRow) => {
          const dateObj = new Date(`${d.event_date}T12:00:00`)
          return {
            id: d.id,
            date: dateObj.getDate(),
            title: d.title,
            description: d.description || "",
            time: d.time || "",
            collabId: d.collab_id,
            creatorEmail: d.creator_email || undefined,
            month: dateObj.getMonth(),
            year: dateObj.getFullYear()
          }
        })
        setEvents(previous => [...previous, ...newEvents])
        setIsModalOpen(false)
      } else {
        alert("Erro ao guardar evento: " + (result.error || "Erro desconhecido"))
      }
    } catch {
      alert("Não foi possível confirmar a gravação. Consulte o calendário antes de repetir o pedido.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = (new Date(year, month, 1).getDay() + 6) % 7 // Portugal: weeks start Monday
  
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
  const dayNames = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

  const moveMonth = (offset: number) => {
    const nextDate = new Date(year, month + offset, 1)
    setCurrentDate(nextDate)
    setSelectedDay((day) => Math.min(day || 1, new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()))
  }

  const days = []
  for (let i = 0; i < firstDayOfMonth; i++) days.push({ day: null, isCurrentMonth: false })
  for (let i = 1; i <= daysInMonth; i++) days.push({ day: i, isCurrentMonth: true })

  const today = new Date()
  const isToday = (d: number) => today.getDate() === d && today.getMonth() === month && today.getFullYear() === year

  const holidaysThisYear = useMemo(() => {
    const list: CalendarHoliday[] = []
    if (showPtHolidays) list.push(...getPortugueseHolidays(year))
    if (showEsHolidays) list.push(...getSpanishHolidays(year))
    return list
  }, [year, showPtHolidays, showEsHolidays])
  const selectedEvents = events.filter((event) => event.date === selectedDay && event.month === month && event.year === year)
  const selectedHolidays = holidaysThisYear.filter((holiday) => holiday.date === selectedDay && holiday.month === month)
  const eventCount = events.filter((event) => event.month === month && event.year === year).length

  return (
    <>
      <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] shadow-sm overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 md:px-5 border-b border-[var(--border-subtle)] flex flex-col gap-4 bg-[var(--surface-bg)]">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--surface-muted)] flex items-center justify-center text-[var(--accent)] border border-[var(--border-subtle)]">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Agenda de operações</h2>
              <p className="text-xs text-[var(--text-secondary)]">{eventCount} {eventCount === 1 ? "evento" : "eventos"} neste mês · Semana de segunda a domingo{isLoading ? " · A atualizar…" : ""}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Holiday filter toggles */}
            <div className="flex items-center gap-1.5 bg-[var(--surface-bg)] px-2 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs">
              <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold mr-1">Feriados</span>
              <button
                type="button"
                onClick={() => setShowPtHolidays(!showPtHolidays)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold transition-all border cursor-pointer ${
                  showPtHolidays 
                    ? "bg-[var(--surface-bg)] text-[var(--text-primary)] border-[var(--border-strong)] shadow-2xs" 
                    : "text-[var(--text-tertiary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                }`}
                title="Mostrar/ocultar feriados de Portugal"
              >
                <MinimalFlag country="PT" />
                <span className="font-mono text-[10px] font-bold">PT</span>
              </button>
              <button
                type="button"
                onClick={() => setShowEsHolidays(!showEsHolidays)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold transition-all border cursor-pointer ${
                  showEsHolidays 
                    ? "bg-[var(--surface-bg)] text-[var(--text-primary)] border-[var(--border-strong)] shadow-2xs" 
                    : "text-[var(--text-tertiary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                }`}
                title="Mostrar/ocultar feriados de Espanha (Atenção a expedições e trânsito)"
              >
                <MinimalFlag country="ES" />
                <span className="font-mono text-[10px] font-bold">ES</span>
              </button>
            </div>

            <div className="flex items-center bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-lg p-1">
              <button type="button" aria-label="Mês anterior" onClick={() => moveMonth(-1)} className="w-9 h-9 flex items-center justify-center hover:bg-[var(--surface-muted)] rounded-md transition-colors text-[var(--text-secondary)]">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-[var(--text-primary)] w-32 text-center capitalize">
                {monthNames[month]} {year}
              </span>
              <button type="button" aria-label="Mês seguinte" onClick={() => moveMonth(1)} className="w-9 h-9 flex items-center justify-center hover:bg-[var(--surface-muted)] rounded-md transition-colors text-[var(--text-secondary)]">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button 
              type="button"
              onClick={() => openAddEvent(selectedDay || new Date().getDate())}
              className="flex items-center gap-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Novo evento</span>
            </button>
            <button
              type="button"
              onClick={enableNotifications}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              title={notificationPermission === "denied" ? "As notificações estão bloqueadas nas definições do navegador" : "Os lembretes aparecem enquanto o calendário está aberto"}
            >
              {notificationPermission === "granted" ? <BellRing className="h-4 w-4 text-[var(--accent)]" /> : <Bell className="h-4 w-4" />}
              <span>
                {notificationPermission === "granted"
                  ? "Lembretes ativos"
                  : notificationPermission === "denied"
                    ? "Lembretes bloqueados"
                    : "Ativar lembretes"}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--border-subtle)] pt-3">
            <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">Equipa</span>
            {collaborators.map(c => (
              <div key={c.id} className="flex items-center gap-1.5" title={c.name}>
                <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                <span className="text-xs font-medium text-[var(--text-secondary)]">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex flex-col p-3 md:p-5">
          <div className="overflow-x-auto pb-1">
          <div className="min-w-[700px]">
          <div className="grid grid-cols-7 mb-2">
            {dayNames.map((d, index) => (
              <div key={d} className={`text-center text-[11px] font-bold uppercase tracking-wider py-2 ${index >= 5 ? "bg-[#155EEF] text-white" : "text-[var(--text-secondary)]"}`}>
                {d}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-px bg-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-lg overflow-hidden">
            {days.map((d, i) => {
              if (!d.isCurrentMonth) {
                return <div key={`empty-${i}`} aria-hidden="true" className="bg-[var(--surface-muted)]/35 min-h-[104px] md:min-h-[124px] p-2" />
              }

              const dayEvents = events.filter(e => e.date === d.day && e.month === month && e.year === year)
              const dayHolidays = holidaysThisYear.filter(h => h.date === d.day && h.month === month)
              const isWeekend = i % 7 >= 5
              const isCurrDay = isToday(d.day!)

              return (
                <button
                  type="button"
                  key={`day-${d.day}`} 
                  onClick={() => setSelectedDay(d.day!)}
                  aria-pressed={selectedDay === d.day}
                  className={`text-left min-h-[104px] md:min-h-[124px] p-2 transition-colors group relative cursor-pointer focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${isWeekend ? styles.weekend : "bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)]"} ${
                    selectedDay === d.day ? 'ring-2 ring-inset ring-[var(--accent)]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex flex-col gap-0.5 w-full pr-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full shrink-0 ${
                          isCurrDay 
                            ? 'bg-[var(--accent)] text-white shadow-sm' 
                            : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                        }`}>
                          {d.day}
                        </span>
                      </div>

                      {dayHolidays.length > 0 && (
                        <div className="flex flex-col gap-0.5 mt-0.5 w-full">
                          {dayHolidays.map((h, hIdx) => (
                            <div 
                              key={hIdx} 
                              title={`${h.country === "PT" ? "Feriado Portugal" : "Feriado Espanha (Atenção a Trânsito e Entregas)"}: ${h.title}`}
                              className="text-[8.5px] font-medium leading-tight py-0.5 flex items-center gap-1.5 truncate text-[var(--text-primary)]"
                            >
                              <MinimalFlag country={h.country} />
                              <span className="truncate">{h.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-tertiary)] shrink-0 mt-0.5" aria-hidden="true">
                      <Plus className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  
                  <div className="space-y-1.5 flex flex-col overflow-y-auto max-h-[80px] pr-1 custom-scrollbar">
                    {dayEvents.map(event => {
                      const collab = collaborators.find(c => c.id === event.collabId) || { name: "Equipa", color: 'bg-[var(--surface-muted)] text-[var(--text-secondary)] border-[var(--border-subtle)]', dot: 'bg-gray-400' }
                      return (
                        <div 
                          key={event.id}
                          className={`text-[10px] font-medium leading-tight p-1.5 rounded border ${collab.color} shadow-2xs flex flex-col gap-0.5 cursor-pointer hover:brightness-110 transition-all`}
                          title={`${event.title}\n${event.description || ''}\nPor: ${event.creatorEmail || 'Admin'}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${collab?.dot}`} />
                            <span className="truncate font-bold">{event.title}</span>
                          </div>
                          <div className="flex items-center justify-between text-[8px] opacity-80 pl-3">
                            <span>{event.time || "Dia inteiro"}</span>
                            <span className="ml-1 truncate">{collab.name}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </button>
              )
            })}
          </div>
          </div>
          </div>

          <section aria-label="Detalhes do dia selecionado" className="mt-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)]/50">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Dia selecionado</p>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{selectedDay} de {monthNames[month]} de {year}</h3>
              </div>
              <button type="button" onClick={() => openAddEvent(selectedDay || undefined)} className="inline-flex items-center justify-center gap-1.5 min-h-9 px-3 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] text-xs font-semibold transition-colors">
                <Plus className="w-3.5 h-3.5" /> Adicionar ao dia
              </button>
            </div>
            <div className="p-4 space-y-2">
              {selectedHolidays.map((holiday) => (
                <div key={`${holiday.country}-${holiday.title}`} className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <MinimalFlag country={holiday.country} />
                  <span className="font-medium">{holiday.title}</span>
                  <span className="text-xs text-[var(--text-secondary)]">{holiday.country === "PT" ? "Portugal" : "Espanha"}</span>
                </div>
              ))}
              {selectedEvents.map((event) => {
                const collaborator = collaborators.find((person) => person.id === event.collabId)
                return <div key={event.id} className="flex items-start gap-3 rounded-md border border-[var(--border-subtle)] px-3 py-2.5">
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{event.title}</p>
                    {event.description && <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{event.description}</p>}
                    <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{event.time || "Dia inteiro"}{collaborator ? ` · ${collaborator.name}` : ""}</p>
                  </div>
                </div>
              })}
              {selectedHolidays.length === 0 && selectedEvents.length === 0 && <p className="text-sm text-[var(--text-secondary)]">Sem eventos ou feriados neste dia.</p>}
            </div>
          </section>
        </div>
      </div>

      {/* Add Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] shadow-xl w-full max-w-md max-h-[90dvh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Novo Evento</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Título do Evento</label>
                  <input 
                    type="text" 
                    required
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="Ex: Férias da Ana, reunião de equipa…"
                    className="w-full bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
                
                <label className="col-span-2 block text-xs font-semibold text-[var(--text-secondary)]">Colaborador
                  <select required value={formData.collabId} onChange={e => setFormData({...formData, collabId: e.target.value})} className="mt-1.5 w-full bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]">
                    <option value="">Selecionar colaborador</option>
                    {collaborators.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-[var(--text-secondary)]">Data de início
                  <input type="date" required value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value, endDate: formData.endDate < e.target.value ? e.target.value : formData.endDate})} className="mt-1.5 w-full min-w-0 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]" />
                </label>
                <label className="block text-xs font-semibold text-[var(--text-secondary)]">Data de fim
                  <input type="date" required min={formData.startDate} value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} className="mt-1.5 w-full min-w-0 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]" />
                </label>
                <div className="col-span-2 space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                    <input type="checkbox" checked={formData.allDay} onChange={e => setFormData({...formData, allDay: e.target.checked})} className="accent-[var(--accent)]" /> Dia inteiro
                  </label>
                  <p className="text-xs text-[var(--text-secondary)]">Para férias ou ausências, marque o período completo. O evento aparece em todos os dias, incluindo a data de fim.</p>
                </div>
                {!formData.allDay && <>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)]">Hora de início
                    <input type="time" required value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="mt-1.5 w-full bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]" />
                  </label>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)]">Hora de fim
                    <input type="time" required min={formData.time} value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} className="mt-1.5 w-full bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]" />
                  </label>
                  <p className="col-span-2 text-xs text-[var(--text-secondary)]">Este horário aplica-se a cada dia do período.</p>
                </>}

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Descrição (Opcional)</label>
                  <textarea 
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="Detalhes adicionais..."
                    className="w-full bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
                  />
                </div>
              </div>
              
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-[var(--border-subtle)]">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  {isSubmitting && <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                  {isSubmitting ? "A guardar…" : "Guardar Evento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
