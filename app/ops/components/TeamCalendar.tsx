"use client"

import React, { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { User as SupabaseUser } from "@supabase/supabase-js"

import { getColaboradoresAction } from "@/app/actions/colaboradores"

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

const STORAGE_KEY = "tms_calendar_events"

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

// Calculate Portuguese holidays for a given year
function getPortugueseHolidays(year: number) {
  const holidays = [
    { date: 1, month: 0, title: "Ano Novo" },
    { date: 25, month: 3, title: "Dia da Liberdade" },
    { date: 1, month: 4, title: "Dia do Trabalhador" },
    { date: 10, month: 5, title: "Dia de Portugal" },
    { date: 15, month: 7, title: "Assunção de N. Sra." },
    { date: 5, month: 9, title: "Implantação da República" },
    { date: 1, month: 10, title: "Todos os Santos" },
    { date: 1, month: 11, title: "Restauração da Indep." },
    { date: 8, month: 11, title: "Imaculada Conceição" },
    { date: 25, month: 11, title: "Natal" }
  ]

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
  
  const easterDate = new Date(year, month, day)
  holidays.push({ date: day, month: month, title: "Páscoa" })
  
  const goodFriday = new Date(easterDate.getTime() - 2 * 24 * 60 * 60 * 1000)
  holidays.push({ date: goodFriday.getDate(), month: goodFriday.getMonth(), title: "Sexta-feira Santa" })
  
  const corpusChristi = new Date(easterDate.getTime() + 60 * 24 * 60 * 60 * 1000)
  holidays.push({ date: corpusChristi.getDate(), month: corpusChristi.getMonth(), title: "Corpo de Deus" })
  
  const carnaval = new Date(easterDate.getTime() - 47 * 24 * 60 * 60 * 1000)
  holidays.push({ date: carnaval.getDate(), month: carnaval.getMonth(), title: "Carnaval" })

  return holidays
}

import { fetchCalendarEvents, addCalendarEvent } from "../../actions/calendar"

export function TeamCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [formData, setFormData] = useState({ title: "", description: "", time: "" })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [collaborators, setCollaborators] = useState<any[]>([])

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
        const mapped: CalendarEvent[] = data.map((d: any) => {
          const dateObj = new Date(d.event_date)
          return {
            id: d.id,
            date: dateObj.getDate(),
            month: dateObj.getMonth(),
            year: dateObj.getFullYear(),
            title: d.title,
            description: d.description || "",
            time: d.time || "",
            collabId: d.collab_id,
            creatorEmail: d.creator_email
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
    if (typeof window !== "undefined" && "Notification" in window) {
      Notification.requestPermission()
    }
    
    const checkNotifications = () => {
      const now = new Date()
      
      // Events 1 hour before
      events.forEach(e => {
        if (!e.time) return
        const [hours, minutes] = e.time.split(":").map(Number)
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
      const holidays = getPortugueseHolidays(now.getFullYear())
      holidays.forEach(h => {
        const holidayTime = new Date(now.getFullYear(), h.month, h.date)
        const diffDays = Math.round((holidayTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        
        if (diffDays === 3 && now.getHours() === 10 && now.getMinutes() === 0) {
          if (Notification.permission === "granted") {
            new Notification("Feriado a aproximar-se!", {
              body: `O feriado de ${h.title} é daqui a 3 dias.`,
              icon: "/favicon.png"
            })
          }
        }
      })
    }
    
    const interval = setInterval(checkNotifications, 60000) // check every minute
    return () => clearInterval(interval)
  }, [events])

  const openAddEvent = (day?: number) => {
    setSelectedDay(day || new Date().getDate())
    setFormData({ title: "", description: "", time: "09:00" })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title) return
    setIsSubmitting(true)
    
    // Find creator's color from dynamic collaborators
    const myCollab = collaborators.find(c => c.email === user?.email) || collaborators[0] || { id: "unknown", color: PALETTE[0].color, dot: PALETTE[0].dot }
    const currentSelectedDay = selectedDay || new Date().getDate()
    
    // YYYY-MM-DD
    const eventDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(currentSelectedDay).padStart(2, '0')}`

    const result = await addCalendarEvent({
      title: formData.title,
      description: formData.description,
      time: formData.time,
      event_date: eventDate,
      collab_id: myCollab.id,
      creator_email: user?.email || "Admin Local"
    })
    
    if (result.success && result.data) {
      const d = result.data
      const dateObj = new Date(d.event_date)
      const newEvent: CalendarEvent = {
        id: d.id,
        date: dateObj.getDate(),
        title: d.title,
        description: d.description || "",
        time: d.time || "",
        collabId: d.collab_id,
        creatorEmail: d.creator_email,
        month: dateObj.getMonth(),
        year: dateObj.getFullYear()
      }
      setEvents([...events, newEvent])
      setIsModalOpen(false)
    } else {
      alert("Erro ao guardar evento.")
    }
    setIsSubmitting(false)
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay() // 0 is Sunday
  
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const days = []
  for (let i = 0; i < firstDayOfMonth; i++) days.push({ day: null, isCurrentMonth: false })
  for (let i = 1; i <= daysInMonth; i++) days.push({ day: i, isCurrentMonth: true })

  const today = new Date()
  const isToday = (d: number) => today.getDate() === d && today.getMonth() === month && today.getFullYear() === year

  const holidaysThisYear = getPortugueseHolidays(year)

  return (
    <>
      <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] shadow-2xs overflow-hidden min-h-[800px] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--surface-muted)]/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20 shadow-inner">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Calendário de Equipa</h2>
              <p className="text-xs text-[var(--text-tertiary)]">Apontamentos e notas (Codificado por cor)</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Legend with dynamic names */}
            <div className="hidden md:flex items-center gap-3 mr-4 bg-[var(--surface-bg)] px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] shadow-xs">
              <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold mr-1">Equipa:</span>
              {collaborators.map(c => (
                <div key={c.id} className="flex items-center gap-1.5 cursor-pointer hover:scale-105 transition-transform" title={c.name}>
                  <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                  <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{c.name}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md p-1">
              <button onClick={prevMonth} className="p-1.5 hover:bg-[var(--border-strong)] rounded transition-colors text-[var(--text-secondary)]">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-[var(--text-primary)] w-32 text-center capitalize">
                {monthNames[month]} {year}
              </span>
              <button onClick={nextMonth} className="p-1.5 hover:bg-[var(--border-strong)] rounded transition-colors text-[var(--text-secondary)]">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button 
              onClick={() => openAddEvent()}
              className="flex items-center gap-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-4 py-2 rounded-md text-sm font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Evento</span>
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 flex flex-col p-5">
          <div className="grid grid-cols-7 mb-2">
            {dayNames.map(d => (
              <div key={d} className="text-center text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>
          
          <div className="flex-1 grid grid-cols-7 gap-px bg-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-lg overflow-hidden">
            {days.map((d, i) => {
              if (!d.isCurrentMonth) {
                return <div key={`empty-${i}`} className="bg-[var(--surface-bg)]/40 min-h-[120px] p-2" />
              }

              const dayEvents = events.filter(e => e.date === d.day && e.month === month && e.year === year)
              const dayHoliday = holidaysThisYear.find(h => h.date === d.day && h.month === month)
              const isCurrDay = isToday(d.day!)

              return (
                <div 
                  key={`day-${d.day}`} 
                  onClick={() => openAddEvent(d.day!)}
                  className={`bg-[var(--surface-bg)] min-h-[120px] p-2 transition-colors hover:bg-[var(--surface-muted)] group relative cursor-pointer ${isCurrDay ? 'ring-1 ring-inset ring-[var(--accent)] bg-[var(--accent)]/5' : ''} ${dayHoliday ? 'bg-red-500/5' : ''}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isCurrDay ? 'bg-[var(--accent)] text-white shadow-sm' : dayHoliday ? 'text-red-500 bg-red-500/10' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}>
                        {d.day}
                      </span>
                      {dayHoliday && (
                        <span className="text-[9px] font-bold text-red-500/80 leading-tight uppercase tracking-tight line-clamp-2 pr-1">{dayHoliday.title}</span>
                      )}
                    </div>
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-tertiary)] hover:text-[var(--text-primary)] shrink-0 mt-0.5">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  <div className="space-y-1.5 flex flex-col overflow-y-auto max-h-[80px] pr-1 custom-scrollbar">
                    {dayEvents.map(event => {
                      const collab = collaborators.find(c => c.id === event.collabId) || { color: 'bg-[var(--surface-muted)] text-[var(--text-secondary)] border-[var(--border-subtle)]', dot: 'bg-gray-400' }
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
                            <span>{event.time}</span>
                            {/* We just show color for creator, but we store the email in tooltip */}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
                    placeholder="Ex: Reunião Equipa..."
                    className="w-full bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Data</label>
                  <input 
                    type="text" 
                    readOnly
                    value={`${selectedDay} de ${monthNames[month]}`}
                    className="w-full bg-[var(--surface-muted)]/50 border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] cursor-not-allowed"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Hora</label>
                  <input 
                    type="time" 
                    value={formData.time}
                    onChange={e => setFormData({...formData, time: e.target.value})}
                    className="w-full bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>

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
                  className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  Guardar Evento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
