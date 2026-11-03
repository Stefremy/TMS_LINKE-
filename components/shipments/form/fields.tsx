"use client"

import { useId, type ReactNode } from "react"
import { useFormContext, type FieldPath } from "react-hook-form"
import type { ShipmentFormValues } from "./schema"

export const inputClass = "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-xs outline-none transition-colors placeholder:text-zinc-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500 aria-invalid:border-red-400 aria-invalid:focus:ring-red-100 motion-reduce:transition-none"
export const secondaryButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-xs hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
export const primaryButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"

export function FormField({ name, label, type = "text", hint, placeholder, onValueChange, autoComplete, step, min, compact = false }: {
  name: FieldPath<ShipmentFormValues>; label: string; type?: string; hint?: string; placeholder?: string
  onValueChange?: (value: string) => string | void; autoComplete?: string; step?: string; min?: number; compact?: boolean
}) {
  const id = useId()
  const { register, getFieldState, formState } = useFormContext<ShipmentFormValues>()
  const { error } = getFieldState(name, formState)
  const message = typeof error?.message === "string" ? error.message : undefined
  const field = register(name, type === "number" ? { valueAsNumber: true } : undefined)
  return <div className="min-w-0 space-y-1.5">
    <label htmlFor={id} className={`block font-medium text-zinc-700 ${compact ? "text-xs" : "text-sm"}`}>{label}</label>
    <input {...field} id={id} type={type} step={step} min={min} placeholder={placeholder} autoComplete={autoComplete}
      aria-invalid={!!error} aria-describedby={error || hint ? `${id}-help` : undefined} className={compact ? `${inputClass.replace("py-2.5", "py-2")} min-h-11 sm:min-h-10` : inputClass}
      onChange={event => { const value = onValueChange?.(event.target.value); if (typeof value === "string") event.target.value = value; void field.onChange(event) }} />
    {(error || hint) && <p id={`${id}-help`} role={error ? "alert" : undefined} className={`text-xs leading-relaxed ${error ? "text-red-700" : "text-zinc-500"}`}>{message || hint}</p>}
  </div>
}

export function FormSection({ title, description, icon, children, compact = false, dense = false }: { title: string; description?: string; icon?: ReactNode; children: ReactNode; compact?: boolean; dense?: boolean }) {
  return <section className="rounded-xl border border-zinc-200 bg-white shadow-xs">
    <header className={`flex items-center gap-3 border-b border-zinc-100 ${dense ? "px-3 py-2.5" : compact ? "px-4 py-3" : "px-5 py-5 sm:px-6"}`}>
      {icon && <div className={`rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-600 ${dense ? "p-1" : compact ? "p-1.5" : "mt-0.5 p-2"}`}>{icon}</div>}
      <div><h2 className="text-base font-semibold tracking-tight text-zinc-900">{title}</h2>{description && <p className="mt-1 text-sm leading-relaxed text-zinc-500">{description}</p>}</div>
    </header><div className={dense ? "space-y-1.5 p-3" : compact ? "space-y-3 p-4" : "space-y-5 p-5 sm:p-6"}>{children}</div>
  </section>
}

export function FieldError({ name }: { name: keyof ShipmentFormValues }) {
  const { getFieldState, formState } = useFormContext<ShipmentFormValues>()
  const error = getFieldState(name, formState).error
  const message = typeof error?.message === "string" ? error.message : undefined
  return message ? <p role="alert" className="text-sm text-red-700">{message}</p> : null
}
