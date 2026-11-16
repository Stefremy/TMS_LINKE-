"use client"

import { useCallback, useEffect, useState } from "react"

/** What the client portal does with the label right after a shipment is created. */
export type LabelPreference = "download" | "print" | "manual"

export const LABEL_PREFERENCES: { id: LabelPreference; title: string; description: string }[] = [
  { id: "download", title: "Descarregar PDF", description: "O PDF da etiqueta é descarregado automaticamente ao emitir o envio." },
  { id: "print", title: "Abrir para imprimir", description: "A etiqueta abre num novo separador, pronta a imprimir, sem ficar guardada nas transferências." },
  { id: "manual", title: "Perguntar sempre", description: "Nada abre sozinho. Escolhe Descarregar ou Imprimir depois de emitir o envio." },
]

const DEFAULT_PREFERENCE: LabelPreference = "download"
const key = (clientId: string) => `linke:label-preference:${clientId}`
const isPreference = (value: unknown): value is LabelPreference => value === "download" || value === "print" || value === "manual"

/** Stored per browser: printing depends on the device and printer being used. */
export function readLabelPreference(clientId: string): LabelPreference {
  try {
    const value = window.localStorage.getItem(key(clientId))
    return isPreference(value) ? value : DEFAULT_PREFERENCE
  } catch { return DEFAULT_PREFERENCE }
}

export function writeLabelPreference(clientId: string, preference: LabelPreference) {
  try { window.localStorage.setItem(key(clientId), preference) } catch { /* private mode: keep default */ }
}

export function useLabelPreference(clientId: string) {
  const [preference, setPreference] = useState<LabelPreference>(DEFAULT_PREFERENCE)
  useEffect(() => { setPreference(readLabelPreference(clientId)) }, [clientId])
  const update = useCallback((next: LabelPreference) => { setPreference(next); writeLabelPreference(clientId, next) }, [clientId])
  return [preference, update] as const
}
