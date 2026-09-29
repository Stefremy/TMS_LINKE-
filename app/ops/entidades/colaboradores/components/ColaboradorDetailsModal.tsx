"use client"

import * as React from "react"
import {
  X,
  Mail,
  Phone,
  Calendar,
  Shield,
  MapPin,
  CheckCircle2,
  Copy,
  Check,
  Edit,
  Key
} from "lucide-react"
import { Colaborador } from "../types"

interface ColaboradorDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  colaborador: Colaborador | null
  onEdit?: (colaborador: Colaborador) => void
  onManageAuth?: (colaborador: Colaborador) => void
}

export function ColaboradorDetailsModal({
  isOpen,
  onClose,
  colaborador,
  onEdit,
  onManageAuth,
}: ColaboradorDetailsModalProps) {
  const [copiedEmail, setCopiedEmail] = React.useState(false)
  const [copiedPhone, setCopiedPhone] = React.useState(false)

  if (!isOpen || !colaborador) return null

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(colaborador.email)
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(colaborador.phone)
    setCopiedPhone(true)
    setTimeout(() => setCopiedPhone(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[var(--surface-bg)] rounded-2xl shadow-[var(--shadow-layer)] border border-[var(--border-subtle)] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-subtle)] flex items-start justify-between bg-[var(--surface-muted)]">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div
              className="w-14 h-14 rounded-xl text-white flex items-center justify-center text-xl font-bold shadow-md shrink-0 overflow-hidden"
              style={{ backgroundColor: colaborador.avatar_color || "var(--accent)" }}
            >
              {colaborador.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={colaborador.avatar} alt={colaborador.name} className="w-full h-full object-cover" />
              ) : (
                colaborador.name.charAt(0).toUpperCase()
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Status badge */}
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                  colaborador.status === "Ativo"
                    ? "bg-[var(--status-success-soft)] text-[var(--status-success)] border-[rgba(18,138,71,0.2)]"
                    : colaborador.status === "Férias"
                    ? "bg-[var(--status-warning-soft)] text-[var(--status-warning)] border-[rgba(217,119,6,0.2)]"
                    : "bg-[var(--surface-muted)] text-[var(--text-tertiary)] border-[var(--border-subtle)]"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                    colaborador.status === "Ativo" ? "bg-[var(--accent)]" : colaborador.status === "Férias" ? "bg-[var(--status-warning)]" : "bg-[var(--text-tertiary)]"
                  }`} />
                  {colaborador.status}
                </span>

                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[var(--surface-bg)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                  <Shield className="w-3 h-3" />
                  {colaborador.access_level}
                </span>

                <span className="text-[11px] font-mono text-[var(--text-tertiary)] bg-[var(--surface-bg)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-md">
                  {colaborador.code}
                </span>
              </div>

              <h2 className="text-xl font-bold text-[var(--text-primary)] mt-1.5 leading-snug">
                {colaborador.name}
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                {colaborador.role} &bull; <span className="text-[var(--accent)] font-semibold">{colaborador.department}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onManageAuth && (
              <button
                onClick={() => { onClose(); onManageAuth(colaborador) }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--accent)] bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)]/80 border border-[rgba(18,138,71,0.2)] transition-colors shadow-2xs cursor-pointer"
                title="Atribuir / Alterar Credenciais de Acesso"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Credenciais &amp; Password</span>
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => { onClose(); onEdit(colaborador) }}
                className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-bg)] border border-transparent hover:border-[var(--border-subtle)] transition-colors cursor-pointer"
                title="Editar Colaborador"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-bg)] border border-transparent hover:border-[var(--border-subtle)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">

          {/* Contacts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--surface-bg)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-tertiary)]">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block">Email Institucional</span>
                  <a href={`mailto:${colaborador.email}`} className="text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors">
                    {colaborador.email}
                  </a>
                </div>
              </div>
              <button
                onClick={handleCopyEmail}
                className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors cursor-pointer"
                title="Copiar email"
              >
                {copiedEmail ? <Check className="w-3.5 h-3.5 text-[var(--accent)]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--surface-bg)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-tertiary)]">
                  <Phone className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block">Contacto Telefónico</span>
                  <a href={`tel:${colaborador.phone}`} className="text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors">
                    {colaborador.phone}
                  </a>
                </div>
              </div>
              <button
                onClick={handleCopyPhone}
                className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors cursor-pointer"
                title="Copiar telefone"
              >
                {copiedPhone ? <Check className="w-3.5 h-3.5 text-[var(--accent)]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Dados Operacionais */}
          <div className="bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-3">
            <h3 className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
              Dados Operacionais &amp; Contratuais
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[10px] text-[var(--text-tertiary)] font-semibold block mb-0.5">Agência / Local de Trabalho:</span>
                <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5 text-xs">
                  <MapPin className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                  {colaborador.agency_location}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-[var(--text-tertiary)] font-semibold block mb-0.5">Data de Admissão:</span>
                <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                  {new Date(colaborador.admission_date).toLocaleDateString("pt-PT")}
                </span>
              </div>

              {colaborador.nif && (
                <div>
                  <span className="text-[10px] text-[var(--text-tertiary)] font-semibold block mb-0.5">NIF:</span>
                  <span className="font-mono font-bold text-[var(--text-primary)] text-xs">{colaborador.nif}</span>
                </div>
              )}

              {colaborador.emergency_contact && (
                <div>
                  <span className="text-[10px] text-[var(--text-tertiary)] font-semibold block mb-0.5">Contacto de Emergência:</span>
                  <span className="font-semibold text-[var(--text-primary)] text-xs">{colaborador.emergency_contact}</span>
                </div>
              )}
            </div>
          </div>

          {/* Permissões */}
          <div className="bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span className="text-xs font-bold text-[var(--text-primary)]">Permissões &amp; Competências Atribuídas</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {colaborador.permissions.map((perm, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--accent-soft)] border border-[rgba(18,138,71,0.15)] rounded-lg text-[11px] font-semibold text-[var(--accent)]"
                >
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  {perm}
                </span>
              ))}
            </div>
          </div>

          {/* Observações */}
          {colaborador.notes && (
            <div className="bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl p-4">
              <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block mb-1.5">
                Observações
              </span>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{colaborador.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-tertiary)] font-medium">
            Membro da Equipa Linke Logistics
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-[var(--text-primary)] bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-lg hover:bg-[var(--surface-muted)] shadow-2xs transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
