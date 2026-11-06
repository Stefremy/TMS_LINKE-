"use client"

import { useSyncExternalStore } from "react"

// A cached snapshot keeps every clock in sync and preserves the server placeholder.
let currentTime: Date | null = null
let timer: ReturnType<typeof setInterval> | undefined
const listeners = new Set<() => void>()
const snapshot = () => currentTime
const serverSnapshot = () => null
function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!timer) {
    currentTime = new Date()
    timer = setInterval(() => {
      currentTime = new Date()
      listeners.forEach(notify => notify())
    }, 1000)
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) { clearInterval(timer); timer = undefined }
  }
}
export function useClock() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot)
}
