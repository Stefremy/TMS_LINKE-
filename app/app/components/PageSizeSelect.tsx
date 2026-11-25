"use client"

import { SHIPMENT_PAGE_SIZES } from "@/lib/services/shipments/shipment-list-filters"

export const CLIENT_PAGE_SIZES = [15, ...SHIPMENT_PAGE_SIZES]

export function PageSizeSelect({ value, onChange, sizes = CLIENT_PAGE_SIZES }: { value: number; onChange: (size: number) => void; sizes?: readonly number[] }) {
  return (
    <label className="flex items-center gap-1.5 font-medium">
      Por página
      <select
        aria-label="Linhas por página"
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        className="h-7 rounded-md border border-[var(--border-strong)] bg-[var(--surface-bg)] px-1.5 text-xs text-[var(--text-primary)]"
      >
        {sizes.map(size => <option key={size} value={size}>{size}</option>)}
      </select>
    </label>
  )
}
