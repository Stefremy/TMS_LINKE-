"use client"

import { Toaster as Sonner } from "sonner"

/** In-page notices (replaces window.alert) styled with the design-system tokens. */
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      closeButton
      toastOptions={{
        duration: 6000,
        style: {
          background: "var(--surface-bg)",
          color: "var(--text-primary)",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-layer)",
          fontFamily: "inherit",
          fontSize: "13px",
        },
      }}
    />
  )
}
