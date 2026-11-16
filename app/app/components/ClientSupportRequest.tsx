"use client"

import * as React from "react"
import { CheckCircle2, HelpCircle, Loader2, X } from "lucide-react"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { createSupportRequestAction } from "@/app/actions/support-requests"
import { SUPPORT_CATEGORIES, type SupportCategory } from "@/lib/support-requests/types"
import { useClientScope } from "./ClientScope"

const field = "mt-1.5 w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-bg)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-2 focus:outline-[var(--accent)]"
const label = "block text-xs font-medium text-[var(--text-secondary)]"

/** Sidebar "Suporte Dedicado" card. Opens a request form that lands in Ops > Mensagens > Pedidos de apoio. */
export function ClientSupportCard({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = React.useState(false)
  const [session, setSession] = React.useState(0) // fresh form each time it opens
  return (
    <>
      <div className={`${compact ? "p-2.5 bg-[var(--surface-bg)] items-center" : "p-3 bg-[var(--surface-muted)] items-start"} border border-[var(--border-subtle)] rounded-lg flex gap-2.5`}>
        <div className={`${compact ? "w-6 h-6" : "w-7 h-7"} rounded-md bg-[var(--accent)] flex items-center justify-center shrink-0`}>
          <HelpCircle className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="min-w-0">
          <p className={`${compact ? "text-[10px] leading-tight" : "text-xs"} text-[var(--text-primary)] font-semibold`}>Suporte Dedicado</p>
          <button type="button" onClick={() => { setSession(value => value + 1); setOpen(true) }} className={`${compact ? "text-[10px]" : "text-xs mt-0.5"} text-[var(--accent)] font-medium hover:underline`}>
            Pedir apoio
          </button>
        </div>
      </div>
      <ClientSupportRequestDialog key={session} open={open} onOpenChange={setOpen} />
    </>
  )
}

export type SupportPrefill = { shipmentRef?: string; subject?: string; category?: SupportCategory }

/** "LTK… · tracking da transportadora" for a shipment, sent along with the support request. */
export function shipmentSupportPrefill(shipment: { reference?: string | null; tracking_number?: string | null; carrier_tracking_number?: string | null; ctt_object_id?: string | null; ctt_label_base64?: string | null }): SupportPrefill {
  const linke = [shipment.reference, shipment.tracking_number].find(value => value?.startsWith("LTK")) || shipment.ctt_label_base64?.match(/Ref:\s*(LTK\d+)/i)?.[1] || shipment.reference || ""
  const carrier = shipment.carrier_tracking_number || shipment.ctt_object_id || (shipment.tracking_number && shipment.tracking_number !== linke ? shipment.tracking_number : "") || ""
  const shipmentRef = [linke, carrier && carrier !== linke ? carrier : ""].filter(Boolean).join(" · ")
  return { shipmentRef, category: "envio", subject: linke ? `Apoio ao envio ${linke}` : "" }
}

export function ClientSupportRequestDialog({ open, onOpenChange, prefill }: { open: boolean; onOpenChange: (open: boolean) => void; prefill?: SupportPrefill }) {
  const { client } = useClientScope()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState("")
  const [sent, setSent] = React.useState(false)
  const today = new Date().toLocaleDateString("en-CA")

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const data = new FormData(event.currentTarget)
    const value = (name: string) => String(data.get(name) || "")
    setPending(true); setError("")
    try {
      const result = await createSupportRequestAction({
        clientId: client.id, category: value("category") as SupportCategory, subject: value("subject"), issueDate: value("issueDate"),
        shipmentRef: value("shipmentRef"), description: value("description"), contact: value("contact"),
      })
      if (!result.success) { setError(result.error); return }
      setSent(true)
    } catch { setError("Não foi possível enviar o pedido. Tente novamente.") }
    finally { setPending(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="text-base font-semibold">Pedido de apoio</DialogTitle>
            <DialogDescription className="mt-1 text-xs text-[var(--text-secondary)]">A equipa Linke recebe o pedido e responde assim que possível.</DialogDescription>
          </div>
          <DialogClose aria-label="Fechar" className="rounded-md p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X className="h-4 w-4" /></DialogClose>
        </div>
        {sent ? (
          <div role="status" className="space-y-4">
            <p className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />Pedido enviado. A equipa Linke vai analisar e entrar em contacto.</p>
            <DialogClose className="w-full rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white">Fechar</DialogClose>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className={label}>Tipo de pedido
              <select name="category" required defaultValue={prefill?.category ?? ""} className={field}>
                <option value="" disabled>Escolha uma opção</option>
                {SUPPORT_CATEGORIES.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
              </select>
            </label>
            <label className={label}>Assunto
              <input name="subject" required minLength={3} maxLength={120} defaultValue={prefill?.subject ?? ""} className={field} placeholder="Resumo do problema" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={label}>Data do problema <span className="font-normal text-[var(--text-tertiary)]">(opcional)</span>
                <input name="issueDate" type="date" max={today} className={field} />
              </label>
              <label className={label}>Ref. Linke / tracking <span className="font-normal text-[var(--text-tertiary)]">(opcional)</span>
                <input name="shipmentRef" maxLength={100} defaultValue={prefill?.shipmentRef ?? ""} className={field} placeholder="Ex.: LTK123456" />
              </label>
            </div>
            <label className={label}>Descrição
              <textarea name="description" required minLength={10} maxLength={3000} rows={5} className={`${field} resize-y`} placeholder="O que aconteceu, o que esperava e o que já tentou." />
            </label>
            <label className={label}>Contacto para resposta <span className="font-normal text-[var(--text-tertiary)]">(opcional)</span>
              <input name="contact" maxLength={120} className={field} placeholder="Telefone ou email, se diferente da conta" />
            </label>
            {error && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
            <button type="submit" disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}{pending ? "A enviar…" : "Enviar pedido"}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
