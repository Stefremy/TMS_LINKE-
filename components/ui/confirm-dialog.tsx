"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog"

type ConfirmOptions = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: "default" | "danger"
}
type PendingConfirm = ConfirmOptions & { resolve: (confirmed: boolean) => void }

let showConfirm: ((pending: PendingConfirm) => void) | null = null

/**
 * In-page replacement for window.confirm(). Resolves true when the person confirms.
 * Needs <ConfirmDialogHost /> mounted once (the client portal shell does this);
 * without it, it falls back to the browser dialog so behaviour never changes.
 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (!showConfirm) {
    return Promise.resolve(window.confirm([options.title, options.description].filter(Boolean).join("\n\n")))
  }
  const show = showConfirm
  return new Promise((resolve) => show({ ...options, resolve }))
}

export function ConfirmDialogHost() {
  const [pending, setPending] = React.useState<PendingConfirm | null>(null)

  React.useEffect(() => {
    const register = (next: PendingConfirm) =>
      setPending((current) => {
        current?.resolve(false)
        return next
      })
    showConfirm = register
    return () => {
      if (showConfirm === register) showConfirm = null
    }
  }, [])

  const settle = (confirmed: boolean) => {
    pending?.resolve(confirmed)
    setPending(null)
  }

  const danger = pending?.tone === "danger"

  return (
    <Dialog open={Boolean(pending)} onOpenChange={(open) => { if (!open) settle(false) }}>
      {pending && (
        <DialogContent role="alertdialog">
          <DialogTitle className="text-base font-semibold text-[var(--text-primary)]">{pending.title}</DialogTitle>
          {pending.description ? (
            <DialogDescription className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--text-secondary)]">
              {pending.description}
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{pending.title}</DialogDescription>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => settle(false)}
              className="min-h-11 sm:min-h-0 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              {pending.cancelLabel ?? "Cancelar"}
            </button>
            <button
              type="button"
              onClick={() => settle(true)}
              className={`min-h-11 sm:min-h-0 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                danger
                  ? "bg-[var(--status-critical)] hover:opacity-90 focus-visible:outline-[var(--status-critical)]"
                  : "bg-[var(--accent)] hover:bg-[var(--accent-hover)] focus-visible:outline-[var(--accent)]"
              }`}
            >
              {pending.confirmLabel ?? "Confirmar"}
            </button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}
