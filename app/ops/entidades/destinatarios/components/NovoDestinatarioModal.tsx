"use client"

import * as React from "react"
import {
  X,
  UserCheck,
  Building2,
  MapPin,
  Phone,
  Mail,
  FileText,
  Loader2,
  Check,
} from "lucide-react"
import { Destinatario } from "../types"
import type { Cliente } from "@/app/ops/entidades/clientes/types"
import { saveDestinatarioAction } from "@/app/actions/destinatarios"
import { usePostalCodeLookup } from "@/lib/hooks/usePostalCodeLookup"
import { Button } from "@/components/ui/button"

interface NovoDestinatarioModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: (destinatario: Destinatario) => void
  clients: Cliente[]
  initialData?: Destinatario | null
  lockedClientId?: string
}

export function NovoDestinatarioModal({
  isOpen,
  onClose,
  onSaved,
  clients,
  initialData,
  lockedClientId,
}: NovoDestinatarioModalProps) {
  const [name, setName] = React.useState("")
  const [clientId, setClientId] = React.useState(lockedClientId || "")
  const [address, setAddress] = React.useState("")
  const [postalCode, setPostalCode] = React.useState("")
  const [city, setCity] = React.useState("")
  const [country, setCountry] = React.useState("PT")
  const [phone, setPhone] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [nif, setNif] = React.useState("")
  const [observations, setObservations] = React.useState("")

  const [isSaving, setIsSaving] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState("")

  // Postal code auto-lookup hook
  usePostalCodeLookup({
    country,
    onFound: (info) => {
      if (info.city) setCity(info.city)
      if (!address && info.street) {
        setAddress(`${info.street}, nº `)
      }
    },
  })

  // Sync state when modal opens or initialData changes
  React.useEffect(() => {
    if (initialData) {
      setName(initialData.name || "")
      setClientId(initialData.client_id || lockedClientId || (clients[0]?.id || ""))
      setAddress(initialData.address || "")
      setPostalCode(initialData.postal_code || "")
      setCity(initialData.city || "")
      setCountry(initialData.country || "PT")
      setPhone(initialData.phone || "")
      setEmail(initialData.email || "")
      setNif(initialData.nif || "")
      setObservations(initialData.observations || "")
    } else {
      setName("")
      setClientId(lockedClientId || (clients[0]?.id || ""))
      setAddress("")
      setPostalCode("")
      setCity("")
      setCountry("PT")
      setPhone("")
      setEmail("")
      setNif("")
      setObservations("")
    }
    setErrorMsg("")
  }, [initialData, isOpen, lockedClientId, clients])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")

    if (!name.trim()) {
      setErrorMsg("O nome do destinatário é obrigatório.")
      return
    }
    if (!address.trim()) {
      setErrorMsg("A morada é obrigatória.")
      return
    }
    if (!postalCode.trim()) {
      setErrorMsg("O código postal é obrigatório.")
      return
    }

    setIsSaving(true)
    try {
      const res = await saveDestinatarioAction({
        id: initialData?.id,
        name: name.trim(),
        client_id: clientId || undefined,
        address: address.trim(),
        postal_code: postalCode.trim(),
        city: city.trim(),
        country,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        nif: nif.trim() || undefined,
        observations: observations.trim() || undefined,
      })

      if (res.success && res.destinatario) {
        onSaved(res.destinatario)
        onClose()
      } else {
        setErrorMsg(res.error || "Erro ao gravar destinatário.")
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Ocorreu um erro inesperado.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-[var(--surface-bg)] rounded-xl shadow-2xl border border-[var(--border-subtle)] w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center border border-[rgba(18,138,71,0.1)]">
              <UserCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)] leading-snug">
                {initialData ? "Editar Destinatário" : "Novo Destinatário"}
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Guardar contacto na agenda para emissão rápida de guias
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-md bg-[var(--status-critical-soft)] border border-[rgba(220,38,38,0.2)] text-[var(--status-critical)] font-medium">
              {errorMsg}
            </div>
          )}

          {/* Cliente remetente (apenas visível se não estiver bloqueado na área do cliente) */}
          {!lockedClientId && clients.length > 0 && (
            <div>
              <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                Cliente Remetente Associado
              </label>
              <div className="relative">
                <Building2 className="w-3.5 h-3.5 text-[var(--text-tertiary)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md pl-8 pr-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                >
                  <option value="">Selecione o Cliente</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.short_name || c.legal_name} ({c.code || "CL"})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Nome e NIF */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                Nome do Destinatário <span className="text-[var(--status-critical)]">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Maria João Pereira ou Loja Central Lda"
                className="w-full bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                NIF (Opcional)
              </label>
              <input
                type="text"
                value={nif}
                onChange={(e) => setNif(e.target.value)}
                placeholder="999999990"
                className="w-full bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] font-mono focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
          </div>

          {/* Morada */}
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              Morada de Entrega (Rua, Nº, Andar) <span className="text-[var(--status-critical)]">*</span>
            </label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 text-[var(--text-tertiary)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Avenida dos Aliados, 120, 2º Direito"
                className="w-full bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md pl-8 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
          </div>

          {/* Código Postal, Cidade e País */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                Código Postal <span className="text-[var(--status-critical)]">*</span>
              </label>
              <input
                type="text"
                required
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="4000-065"
                className="w-full bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] font-mono focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                Localidade / Cidade <span className="text-[var(--status-critical)]">*</span>
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Porto"
                className="w-full bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                País
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              >
                <option value="PT">Portugal (PT)</option>
                <option value="ES">Espanha (ES)</option>
                <option value="FR">França (FR)</option>
                <option value="DE">Alemanha (DE)</option>
              </select>
            </div>
          </div>

          {/* Contactos: Telefone e Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                Telefone / Telemóvel
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-[var(--text-tertiary)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="912 345 678"
                  className="w-full bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md pl-8 pr-3 py-2 text-xs text-[var(--text-primary)] font-mono placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-[var(--text-tertiary)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="destinatario@email.pt"
                  className="w-full bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md pl-8 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              Observações / Instruções de Entrega (Opcional)
            </label>
            <div className="relative">
              <FileText className="w-3.5 h-3.5 text-[var(--text-tertiary)] absolute left-2.5 top-3 pointer-events-none" />
              <textarea
                rows={2}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Código de portão, horário comercial de receção..."
                className="w-full bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md pl-8 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
          </div>

          {/* Footer inside form */}
          <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-1.5 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSaving}
              className="px-4 py-1.5 text-xs font-semibold"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  A guardar...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  {initialData ? "Atualizar Contacto" : "Guardar Destinatário"}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
