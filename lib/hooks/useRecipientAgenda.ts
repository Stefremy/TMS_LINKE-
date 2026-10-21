"use client"

import { useEffect, useState } from "react"
import type { Destinatario } from "@/app/ops/entidades/destinatarios/types"

/** Read the agenda only on demand, and discard responses from a previous store. */
export function useRecipientAgenda(clientId: string | undefined, open: boolean) {
  const [state, setState] = useState<{
    clientId?: string
    recipients: Destinatario[]
    loading: boolean
    error: string | null
  }>({ recipients: [], loading: false, error: null })

  useEffect(() => {
    if (!open || !clientId) return
    let active = true
    import("@/app/actions/destinatarios")
      .then(m => {
        if (!active) return []
        setState({ clientId, recipients: [], loading: true, error: null })
        return m.getDestinatariosAction(clientId)
      })
      .then(recipients => {
        if (active) setState({ clientId, recipients: recipients || [], loading: false, error: null })
      })
      .catch(() => {
        if (active) setState({ clientId, recipients: [], loading: false,
          error: "Não foi possível carregar a agenda. Feche e tente novamente." })
      })
    return () => { active = false }
  }, [clientId, open])

  const matches = state.clientId === clientId
  return {
    recipients: matches ? state.recipients : [],
    loading: Boolean(open && clientId && (!matches || state.loading)),
    error: matches ? state.error : null,
  }
}
