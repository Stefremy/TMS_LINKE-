"use client"

import React from "react"
import { useRouter, useSearchParams } from "next/navigation"

export function DateRangePicker({ defaultFrom, defaultTo }: { defaultFrom: string, defaultTo: string }) {
  const router = useRouter()
  
  const handleApply = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const from = fd.get("from") as string
    const to = fd.get("to") as string
    
    const params = new URLSearchParams(window.location.search)
    if (from) params.set("from", from)
    else params.delete("from")
    
    if (to) params.set("to", to)
    else params.delete("to")
    
    params.delete("month")
    params.delete("year")
    
    router.push(`?${params.toString()}`)
  }

  return (
    <form onSubmit={handleApply} className="flex items-center gap-2 bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-md px-2 py-1 shadow-2xs">
      <input 
        name="from"
        type="date" 
        defaultValue={defaultFrom}
        className="text-[var(--text-primary)] text-sm outline-none bg-transparent"
        required
      />
      <span className="text-[var(--text-tertiary)] text-xs">até</span>
      <input 
        name="to"
        type="date" 
        defaultValue={defaultTo}
        className="text-[var(--text-primary)] text-sm outline-none bg-transparent"
        required
      />
      <button 
        type="submit" 
        className="bg-[var(--surface-muted)] hover:bg-[var(--border-strong)] text-[var(--text-secondary)] text-xs font-medium px-2 py-1 rounded transition-colors ml-1"
      >
        Aplicar
      </button>
    </form>
  )
}
