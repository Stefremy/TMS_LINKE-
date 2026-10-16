"use client"

import * as React from "react"

export const INTERFACE_THEME_KEY = "tms-interface-theme"
const THEME_CHANGE_EVENT = "tms-interface-theme-change"
export type InterfaceTheme = "linke" | "win98" | "winxp" | "linke-vibrant" | "linke-four" | "linke-noir" | "terminal-dos" | "gameboy" | "fallout-pipboy"

function isInterfaceTheme(value: string | null): value is InterfaceTheme {
  return value === "linke" || value === "win98" || value === "winxp" || value === "linke-vibrant" || value === "linke-four" || value === "linke-noir" || value === "terminal-dos" || value === "gameboy" || value === "fallout-pipboy"
}

export function subscribeToThemeChanges(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange)
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange)
  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange)
  }
}

export function getThemeSnapshot(): InterfaceTheme {
  try {
    const savedTheme = localStorage.getItem(INTERFACE_THEME_KEY)
    return isInterfaceTheme(savedTheme) ? savedTheme : "linke"
  } catch {
    return "linke"
  }
}

export function getServerThemeSnapshot(): InterfaceTheme {
  return "linke"
}

export function applyInterfaceTheme(theme: InterfaceTheme) {
  document.documentElement.dataset.tmsTheme = theme
  try {
    localStorage.setItem(INTERFACE_THEME_KEY, theme)
  } catch {
    // Keep the selected theme for the current page even if storage is unavailable.
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const restoreTheme = () => {
      try {
        const savedTheme = localStorage.getItem(INTERFACE_THEME_KEY)
        document.documentElement.dataset.tmsTheme = isInterfaceTheme(savedTheme) ? savedTheme : "linke"
      } catch {
        document.documentElement.dataset.tmsTheme = "linke"
      }
    }

    restoreTheme()
    window.addEventListener("storage", restoreTheme)
    return () => window.removeEventListener("storage", restoreTheme)
  }, [])

  return <>{children}</>
}
