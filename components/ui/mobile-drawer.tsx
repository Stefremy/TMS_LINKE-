"use client"

import { useEffect, useRef, type ReactNode } from "react"

export const PORTAL_DESKTOP_QUERY = "(min-width: 1024px) and (min-height: 500px)"

/** Native modal provides focus containment and keeps the page behind the menu inert. */
export function MobileDrawer({ open, onClose, label, id, children }: {
  open: boolean
  onClose: () => void
  label: string
  id: string
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !open) return
    const desktop = window.matchMedia(PORTAL_DESKTOP_QUERY)
    if (desktop.matches) { onClose(); return }
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = "hidden"
    dialog.querySelector<HTMLButtonElement>("[data-drawer-close]")?.focus()
    const closeOnDesktop = (event: MediaQueryListEvent) => { if (event.matches) onClose() }
    desktop.addEventListener("change", closeOnDesktop)
    return () => {
      desktop.removeEventListener("change", closeOnDesktop)
      if (dialog.open) dialog.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [open, onClose])

  return (
    <dialog ref={dialogRef} id={id} aria-label={label} className="tms-mobile-dialog"
      onCancel={event => { event.preventDefault(); onClose() }}
      onClose={onClose}
      onClick={event => {
        if (event.target === event.currentTarget || (event.target as Element).closest?.("a[href]")) onClose()
      }}>
      {children}
    </dialog>
  )
}
