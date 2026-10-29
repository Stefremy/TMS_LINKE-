"use client"

import type { SelectHTMLAttributes } from "react"
import { COUNTRY_TO_ZONE_MAP } from "@/lib/services/geo/international-zones"

const names = new Intl.DisplayNames(["pt-PT"], { type: "region" })
const codes = [...new Set(["PT", "ES", ...Object.keys(COUNTRY_TO_ZONE_MAP).map(code => code.replace(/_ISO$/, "").replace(/^UK$/, "GB"))])].filter(code => /^[A-Z]{2}$/.test(code))
const options = codes.map(code => ({ code, name: names.of(code) || code }))
  .sort((a, b) => (a.code === "PT" ? -2 : a.code === "ES" ? -1 : 0) - (b.code === "PT" ? -2 : b.code === "ES" ? -1 : 0) || a.name.localeCompare(b.name, "pt-PT"))

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange"> & { value: string; onValueChange: (value: string) => void }
export function CountrySelect({ value, onValueChange, ...props }: Props) {
  const code = value.toUpperCase() === "UK" ? "GB" : value.toUpperCase()
  return <select {...props} value={code} onChange={event => onValueChange(event.target.value)}>
    <option value="">Selecione o país</option>
    {code && !codes.includes(code) && <option value={code}>{code}</option>}
    {options.map(option => <option key={option.code} value={option.code}>{option.name}</option>)}
  </select>
}
