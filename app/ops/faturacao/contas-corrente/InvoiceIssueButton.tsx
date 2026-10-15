"use client"

import { useRef, useState } from "react"

export function InvoiceIssueButton({
  disabled,
  clientName,
  onIssue,
}: {
  disabled: boolean
  clientName: string
  onIssue: () => Promise<void>
}) {
  // This state belongs to this mounted button, independently of every other row.
  const [isPending, setIsPending] = useState(false)
  const inFlight = useRef(false)

  return (
    <button
      type="button"
      disabled={disabled || isPending}
      aria-busy={isPending}
      aria-label={isPending ? `A emitir fatura para ${clientName}` : `Emitir fatura Moloni para ${clientName}`}
      className="flex items-center justify-center px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
      onClick={async (event) => {
        event.stopPropagation()
        if (disabled || inFlight.current) return
        inFlight.current = true
        setIsPending(true)
        try {
          await onIssue()
        } finally {
          inFlight.current = false
          setIsPending(false)
        }
      }}
    >
      {isPending ? "A emitir..." : "Emitir Fatura Moloni"}
    </button>
  )
}
