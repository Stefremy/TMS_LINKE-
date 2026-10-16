"use client"

import * as React from "react"
import {
  X,
  User,
  Building2,
  Mail,
  Phone,
  Shield,
  MapPin,
  Calendar,
  Save,
  Loader2
} from "lucide-react"
import { Colaborador, DEPARTMENTS, ACCESS_LEVELS } from "../types"
import { saveColaboradorAction } from "@/app/actions/colaboradores"

interface ColaboradorModalProps {
  isOpen: boolean
  onClose: () => void
  colaborador?: Colaborador | null
  onSaved: (colaborador: Colaborador) => void
}

const AVATAR_COLORS = [
  "#477D68", // Linke green
  "#376C8A", // Steel blue
  "#8A6944", // Ochre
  "#475569", // Graphite
  "#263F63", // Navy
  "#76516D", // Plum
]

export function ColaboradorModal({
  isOpen,
  onClose,
  colaborador,
  onSaved,
}: ColaboradorModalProps) {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [name, setName] = React.useState("")
  const [role, setRole] = React.useState("")
  const [department, setDepartment] = React.useState<string>(DEPARTMENTS[0])
  const [email, setEmail] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [nif, setNif] = React.useState("")
  const [status, setStatus] = React.useState<"Ativo" | "Inativo" | "Férias">("Ativo")
  const [accessLevel, setAccessLevel] = React.useState<"Administrador" | "Operacional" | "Comercial / Suporte">("Operacional")
  const [agencyLocation, setAgencyLocation] = React.useState("Sede - Felgueiras / Guimarães")
  const [admissionDate, setAdmissionDate] = React.useState(new Date().toISOString().slice(0, 10))
  const [avatarColor, setAvatarColor] = React.useState(AVATAR_COLORS[0])
  const [emergencyContact, setEmergencyContact] = React.useState("")
  const [notes, setNotes] = React.useState("")

  React.useEffect(() => {
    if (colaborador) {
      setName(colaborador.name || "")
      setRole(colaborador.role || "")
      setDepartment(colaborador.department || DEPARTMENTS[0])
      setEmail(colaborador.email || "")
      setPhone(colaborador.phone || "")
      setNif(colaborador.nif || "")
      setStatus(colaborador.status || "Ativo")
      setAccessLevel(colaborador.access_level || "Operacional")
      setAgencyLocation(colaborador.agency_location || "Sede - Felgueiras / Guimarães")
      setAdmissionDate(colaborador.admission_date || new Date().toISOString().slice(0, 10))
      setAvatarColor(colaborador.avatar_color || AVATAR_COLORS[0])
      setEmergencyContact(colaborador.emergency_contact || "")
      setNotes(colaborador.notes || "")
    } else {
      setName("")
      setRole("")
      setDepartment(DEPARTMENTS[0])
      setEmail("")
      setPhone("")
      setNif("")
      setStatus("Ativo")
      setAccessLevel("Operacional")
      setAgencyLocation("Sede - Felgueiras / Guimarães")
      setAdmissionDate(new Date().toISOString().slice(0, 10))
      setAvatarColor(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)])
      setEmergencyContact("")
      setNotes("")
    }
    setError(null)
  }, [colaborador, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError("O nome do colaborador é obrigatório.")
      return
    }
    if (!role.trim()) {
      setError("O cargo/função é obrigatório.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await saveColaboradorAction({
        id: colaborador?.id,
        code: colaborador?.code,
        name: name.trim(),
        role: role.trim(),
        department,
        email: email.trim() || `${name.toLowerCase().replace(/\s+/g, ".")}@linkelogistics.pt`,
        phone: phone.trim() || "910000000",
        mobile_phone: phone.trim() || "910000000",
        nif: nif.trim(),
        status,
        access_level: accessLevel,
        agency_location: agencyLocation.trim(),
        admission_date: admissionDate,
        avatar_color: avatarColor,
        emergency_contact: emergencyContact.trim(),
        notes: notes.trim(),
      })

      if (res.success && res.colaborador) {
        onSaved(res.colaborador)
        onClose()
      } else {
        setError("Erro ao guardar registo do colaborador.")
      }
    } catch (err: any) {
      setError(err?.message || "Ocorreu um erro ao gravar.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-[var(--surface-bg)] rounded-2xl shadow-2xl border border-[var(--border-subtle)] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--surface-muted)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF0EC] text-[var(--accent)] flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {colaborador ? "Editar Colaborador" : "Novo Colaborador"}
              </h2>
              <p className="text-xs text-[var(--text-tertiary)]">
                {colaborador ? `Atualizar dados de ${colaborador.name}` : "Adicionar membro à equipa Linke Logistics"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-dim)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-[var(--status-critical-soft)] border border-[rgba(220,38,38,0.2)] rounded-xl text-xs text-[var(--status-critical)] font-medium">
              {error}
            </div>
          )}

          {/* Nome e Cargo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Nome Completo *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Stefano"
                className="w-full px-3.5 py-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl text-sm focus:bg-[var(--surface-bg)] focus:ring-2 focus:ring-[var(--accent)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Cargo / Função *
              </label>
              <input
                type="text"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Ex: Diretor Geral de Operações"
                className="w-full px-3.5 py-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl text-sm focus:bg-[var(--surface-bg)] focus:ring-2 focus:ring-[var(--accent)] focus:outline-none"
              />
            </div>
          </div>

          {/* Departamento e Nível de Acesso */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Departamento
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl text-sm focus:bg-[var(--surface-bg)] focus:ring-2 focus:ring-[var(--accent)] focus:outline-none"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Nível de Acesso / Perfil
              </label>
              <select
                value={accessLevel}
                onChange={(e) => setAccessLevel(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl text-sm focus:bg-[var(--surface-bg)] focus:ring-2 focus:ring-[var(--accent)] focus:outline-none"
              >
                {ACCESS_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Email e Telefone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@linkelogistics.pt"
                className="w-full px-3.5 py-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl text-sm focus:bg-[var(--surface-bg)] focus:ring-2 focus:ring-[var(--accent)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Telefone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: 910 000 000"
                className="w-full px-3.5 py-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl text-sm focus:bg-[var(--surface-bg)] focus:ring-2 focus:ring-[var(--accent)] focus:outline-none"
              />
            </div>
          </div>

          {/* Estado e Cor Avatar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Estado
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl text-sm focus:bg-[var(--surface-bg)] focus:ring-2 focus:ring-[var(--accent)] focus:outline-none"
              >
                <option value="Ativo">Ativo</option>
                <option value="Férias">Férias</option>
                <option value="Inativo">Inativo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Cor de Identificação (Avatar)
              </label>
              <div className="flex items-center gap-2 pt-1">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAvatarColor(c)}
                    className={`w-7 h-7 rounded-full transition-transform ${
                      avatarColor === c ? "ring-2 ring-offset-2 ring-[var(--accent)] ring-offset-[var(--surface-bg)] scale-110" : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Selecionar cor ${c}`}
                    aria-pressed={avatarColor === c}
                    title={c}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Agência e Data de Admissão */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Localização / Agência
              </label>
              <input
                type="text"
                value={agencyLocation}
                onChange={(e) => setAgencyLocation(e.target.value)}
                placeholder="Ex: Sede - Felgueiras / Guimarães"
                className="w-full px-3.5 py-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl text-sm focus:bg-[var(--surface-bg)] focus:ring-2 focus:ring-[var(--accent)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Data de Admissão
              </label>
              <input
                type="date"
                value={admissionDate}
                onChange={(e) => setAdmissionDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl text-sm focus:bg-[var(--surface-bg)] focus:ring-2 focus:ring-[var(--accent)] focus:outline-none"
              />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Observações
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas operacionais ou funções específicas..."
              className="w-full px-3.5 py-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl text-sm focus:bg-[var(--surface-bg)] focus:ring-2 focus:ring-[var(--accent)] focus:outline-none"
            />
          </div>

          {/* Buttons */}
          <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-xl hover:bg-[var(--surface-muted)] transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-60 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {colaborador ? "Guardar Alterações" : "Criar Colaborador"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
