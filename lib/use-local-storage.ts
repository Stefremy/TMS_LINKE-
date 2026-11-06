"use client"

import { useCallback, useSyncExternalStore } from "react"
const changeEvent = "linke-local-storage"
function subscribe(notify: () => void) {
  window.addEventListener("storage", notify)
  window.addEventListener(changeEvent, notify)
  return () => {
    window.removeEventListener("storage", notify)
    window.removeEventListener(changeEvent, notify)
  }
}
export function useLocalStorage(key: string) {
  const read = useCallback(() => {
    try { return localStorage.getItem(key) } catch { return null }
  }, [key])
  const write = useCallback((value: string | null) => {
    try {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
      window.dispatchEvent(new Event(changeEvent))
    } catch { /* Storage may be unavailable in private browser sessions. */ }
  }, [key])
  return [useSyncExternalStore(subscribe, read, () => null), write] as const
}
