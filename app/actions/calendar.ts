"use server"

import { createClient } from "@/lib/supabase/server"

export type CalendarEventInsert = {
  title: string
  description?: string
  time?: string
  event_date: string // YYYY-MM-DD
  collab_id: string
  creator_email: string
}

export async function fetchCalendarEvents(year: number, month: number) {
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
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("calendar_events")
    .insert([event])
    .select()
    .single()
    
  if (error) {
    console.error("Error adding calendar event:", error)
    return { success: false, error: error.message }
  }
  
  return { success: true, data }
}
