"use client"

import React from "react"
import { useRouter, useSearchParams } from "next/navigation"

export function MonthPicker({ defaultMonth, defaultYear }: { defaultMonth: number, defaultYear: number }) {
  const router = useRouter()
  
  // Format to YYYY-MM
  const monthStr = (defaultMonth + 1).toString().padStart(2, '0')
  const defaultVal = `${defaultYear}-${monthStr}`

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value // "YYYY-MM"
    if (!val) return
    const [y, m] = val.split("-")
    
    const params = new URLSearchParams(window.location.search)
    params.set("year", y)
    params.set("month", String(parseInt(m, 10) - 1)) // JS months are 0-11
    
    router.push(`?${params.toString()}`)
  }

  return (
    <input 
      type="month" 
      defaultValue={defaultVal}
      onChange={handleChange}
      className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm rounded-md px-3 py-1.5 font-medium shadow-2xs hover:border-[var(--border-strong)] transition-colors outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
    />
  )
}
