"use client"

import { useCallback, useSyncExternalStore } from "react"

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

const CHANGE_EVENT = "linke:label-preference"
// The choice made in this tab, so it holds even when storage is unavailable (private mode).
const chosenInThisTab = new Map<string, LabelPreference>()

/** Re-render when the preference changes in this tab (custom event) or in another one (storage event). */
function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange)
  // Another tab changed it: its stored value wins over this tab's earlier choice.
  const onStorage = () => { chosenInThisTab.clear(); onChange() }
  window.addEventListener("storage", onStorage)
  return () => { window.removeEventListener(CHANGE_EVENT, onChange); window.removeEventListener("storage", onStorage) }
}

/** Server render and first client render use the default; the stored choice is read right after. */
export function useLabelPreference(clientId: string) {
  const preference = useSyncExternalStore(subscribe,
    () => chosenInThisTab.get(clientId) ?? readLabelPreference(clientId), () => DEFAULT_PREFERENCE)
  const update = useCallback((next: LabelPreference) => {
    chosenInThisTab.set(clientId, next)
    writeLabelPreference(clientId, next)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [clientId])
  return [preference, update] as const
}
