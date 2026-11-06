"use client"
import { useSyncExternalStore } from "react"
const read = () => `${window.innerWidth},${window.innerHeight}`
function subscribe(notify: () => void) {
  window.addEventListener("resize", notify)
  return () => window.removeEventListener("resize", notify)
}
export function useViewport() {
  const size = useSyncExternalStore(subscribe, read, () => null)
  return size ? size.split(",").map(Number) : null
}
