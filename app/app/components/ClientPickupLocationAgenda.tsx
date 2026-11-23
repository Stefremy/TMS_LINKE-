"use client"

import * as React from "react"
import { deleteClientPickupLocationAction, saveClientPickupLocationAction, setDefaultClientPickupLocationAction } from "@/app/actions/client-pickup-locations"
import { inputClass, primaryButton, secondaryButton } from "@/components/shipments/form/fields"
import { readPickupAddress, type PickupAddress, type PickupLocation } from "@/lib/client-pickup-requests"

export function PickupAddressFields({ values }: { values?: Partial<PickupAddress> }) {
  const field = (name: keyof PickupAddress, label: string, type = "text", maxLength = 100) => (
    <label className="block space-y-1 text-xs font-medium text-[var(--text-secondary)]">
      {label}
      <input name={name} type={type} defaultValue={values?.[name] ?? ""} required={name !== "email"} maxLength={maxLength} className={inputClass} />
    </label>
  )
  return <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      {field("name", "Nome / empresa no local")}
      {field("contact", "Pessoa de contacto")}
    </div>
    {field("address", "Morada de recolha", "text", 200)}
    <div className="grid gap-4 sm:grid-cols-2">
      {field("postal", "Código postal")}
      {field("city", "Localidade")}
      {field("phone", "Telefone / telemóvel", "tel")}
      {field("email", "Email (opcional)", "email", 254)}
    </div>
  </div>
}

export function ClientPickupLocationAgenda({ clientId, locations, defaultLocationId, initialError, disabled, onSaved, onRemoved, onDefaultChanged }: {
  clientId: string
  locations: PickupLocation[]
  defaultLocationId: string | null
  initialError: string
  disabled: boolean
  onSaved: (location: PickupLocation) => void
  onRemoved: (id: string) => void
  onDefaultChanged: (id: string | null) => void
}) {
  const [editor, setEditor] = React.useState<{ id: string; location?: PickupLocation } | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")
  const [message, setMessage] = React.useState("")
  const lock = React.useRef(false)

  function openEditor(location?: PickupLocation) {
    setError("")
    setMessage("")
    setEditor({ id: location?.id ?? crypto.randomUUID(), location })
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editor || disabled || lock.current) return
    const data = new FormData(event.currentTarget)
    lock.current = true
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const input = { ...readPickupAddress(data), label: String(data.get("label") || "") }
      const result = await saveClientPickupLocationAction(input, editor.id, editor.location ? "edit" : "create", clientId)
      if (!result.success) { setError(result.error); return }
      onSaved(result.location)
      setEditor(null)
      setMessage("Local de recolha guardado.")
    } catch {
      setError("Não foi possível guardar o local de recolha. Tente novamente.")
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  async function remove(location: PickupLocation) {
    if (disabled || lock.current || !window.confirm(`Remover «${location.label}» da agenda de recolhas?`)) return
    lock.current = true
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const result = await deleteClientPickupLocationAction(location.id, clientId)
      if (!result.success) { setError(result.error); return }
      onRemoved(location.id)
      if (editor?.id === location.id) setEditor(null)
      setMessage("Local removido da agenda.")
    } catch {
      setError("Não foi possível remover o local de recolha. Tente novamente.")
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  async function setDefault(id: string | null) {
    if (disabled || lock.current) return
    lock.current = true
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const result = await setDefaultClientPickupLocationAction(id, clientId)
      if (!result.success) { setError(result.error); return }
      onDefaultChanged(result.defaultLocationId)
      setMessage(id ? "Local padrão atualizado." : "Morada principal definida como padrão.")
    } catch {
      setError("Não foi possível guardar o local padrão de recolha. Tente novamente.")
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return <details className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 sm:p-5">
    <summary className="cursor-pointer text-sm font-semibold text-[var(--text-primary)]">Agenda de locais de recolha</summary>
    <div className="mt-4 space-y-4">
      {initialError && <p role="alert" className="text-sm text-red-700">{initialError}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="text-sm text-[var(--text-primary)]">{message}</p>}
      {locations.length > 0 ? <ul className="divide-y divide-[var(--border-subtle)]">
        {locations.map(location => <li key={location.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0 break-words">
            <p className="text-sm font-medium text-[var(--text-primary)]">{location.label}{location.id === defaultLocationId && <span className="ml-2 text-xs text-[var(--text-secondary)]">Padrão</span>}</p>
            <p className="text-xs text-[var(--text-secondary)]">{location.address} · {location.postal} {location.city}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {location.id !== defaultLocationId && <button type="button" className={secondaryButton}
              aria-label={`Definir ${location.label} como padrão`} disabled={disabled || busy} onClick={() => void setDefault(location.id)}>Definir como padrão</button>}
            <button type="button" className={secondaryButton} aria-label={`Editar ${location.label}`} disabled={disabled || busy} onClick={() => openEditor(location)}>Editar</button>
            <button type="button" className={secondaryButton} aria-label={`Remover ${location.label}`} disabled={disabled || busy} onClick={() => void remove(location)}>Remover</button>
          </div>
        </li>)}
      </ul> : !initialError && <p className="text-sm text-[var(--text-secondary)]">Ainda não existem locais adicionais guardados.</p>}
      {defaultLocationId && <button type="button" className={secondaryButton} disabled={disabled || busy} onClick={() => void setDefault(null)}>Usar morada principal como padrão</button>}
      {editor ? <form key={editor.id} onSubmit={save} className="rounded-lg border border-[var(--border-subtle)] p-4">
        <fieldset disabled={disabled || busy} className="space-y-4">
          <legend className="mb-3 text-sm font-semibold text-[var(--text-primary)]">{editor.location ? "Editar local" : "Novo local de recolha"}</legend>
          <label className="block space-y-1 text-xs font-medium text-[var(--text-secondary)]">
            Nome na agenda
            <input name="label" type="text" defaultValue={editor.location?.label} maxLength={80} required className={inputClass} placeholder="Ex.: Armazém do Porto" />
          </label>
          <PickupAddressFields values={editor.location} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={primaryButton}>{busy ? "A guardar…" : "Guardar local"}</button>
            <button type="button" className={secondaryButton} onClick={() => { setEditor(null); setError("") }}>Cancelar</button>
          </div>
        </fieldset>
      </form> : <button type="button" className={secondaryButton} disabled={disabled || busy} onClick={() => openEditor()}>Adicionar local</button>}
    </div>
  </details>
}
