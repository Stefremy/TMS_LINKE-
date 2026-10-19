"use server"

import { createClient } from "@/lib/supabase/server"
import { requireEmployee } from "@/lib/auth/context"

export type CalendarEventInsert = {
  title: string
  description?: string
  time?: string
  event_date: string // YYYY-MM-DD
  end_date?: string
  end_time?: string
  all_day?: boolean
  collab_id: string
  creator_email: string
}

export async function fetchCalendarEvents(year: number, month: number) {
  await requireEmployee()
  const supabase = await createClient()
  
  // Format dates for querying (first day of month to last day)
  const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`
  // We can just fetch all events or filter by month in JS for simplicity, 
  // but better to filter by date range.
  const end = new Date(year, month + 1, 0)
  const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`

  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .gte("event_date", startStr)
    .lte("event_date", endStr)
    
  if (error) {
    console.error("Error fetching calendar events:", error)
    return []
  }
  
  return data || []
}

export async function addCalendarEvent(event: CalendarEventInsert) {
  const context = await requireEmployee()
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  const lastDate = event.end_date || event.event_date
  if (!validDate(event.event_date) || !validDate(lastDate) || lastDate < event.event_date) {
    return { success: false, error: "Indique um período de datas válido." }
  }
  const numberOfDays = (Date.parse(lastDate) - Date.parse(event.event_date)) / 86400000 + 1
  if (numberOfDays > 366) return { success: false, error: "Escolha um período de até 366 dias." }
  if (!event.title?.trim() || !event.collab_id?.trim()) return { success: false, error: "Preencha o título e selecione o colaborador." }
  const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
  if (!event.all_day && (!validTime(event.time || "") || (event.end_time && (!validTime(event.end_time) || event.end_time <= (event.time || ""))))) {
    return { success: false, error: "A hora de fim deve ser posterior à hora de início." }
  }
  const supabase = await createClient()
  // One bulk insert is atomic: either the entire period is saved or none of it.
  // Daily rows work with the existing monthly queries, including across months/years.
  const rows = Array.from({ length: numberOfDays }, (_, index) => ({
    title: event.title.trim(),
    description: event.description?.trim() || null,
    time: event.all_day ? null : event.end_time ? `${event.time}–${event.end_time}` : event.time,
    event_date: new Date(Date.parse(`${event.event_date}T00:00:00Z`) + index * 86400000).toISOString().slice(0, 10),
    collab_id: event.collab_id,
    creator_email: context.user.email,
  }))
  
  const { data, error } = await supabase
    .from("calendar_events")
    .insert(rows)
    .select()
    
  if (error) {
    console.error("Error adding calendar event:", error)
    return { success: false, error: error.message }
  }
  
  return { success: true, data: data?.[0], events: data || [] }
}
