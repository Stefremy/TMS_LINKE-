"use client"

import * as React from "react"
import {
  X,
  User,
  Building2,
  Mail,
  Phone,
  Calendar,
  Shield,
  MapPin,
  CheckCircle2,
  FileText,
  Copy,
  Check,
  Edit,
  Tag,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Profile Hero */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div
              className="w-16 h-16 rounded-2xl text-white flex items-center justify-center text-2xl font-bold shadow-md shrink-0"
              style={{ backgroundColor: colaborador.avatar_color || "#16a34a" }}
            >
              {colaborador.name.charAt(0).toUpperCase()}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  colaborador.status === "Ativo"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : colaborador.status === "Férias"
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-slate-100 text-slate-700 border border-slate-200"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                    colaborador.status === "Ativo" ? "bg-emerald-500" : colaborador.status === "Férias" ? "bg-amber-500" : "bg-slate-400"
                  }`} />
                  {colaborador.status}
                </span>

                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  <Shield className="w-3 h-3 mr-1" />
                  {colaborador.access_level}
                </span>

                <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                  {colaborador.code}
                </span>
              </div>

              <h2 className="text-2xl font-bold text-slate-900 mt-1.5 leading-snug">
                {colaborador.name}
              </h2>
              <p className="text-sm font-semibold text-slate-600">
                {colaborador.role} &bull; <span className="text-green-700 font-medium">{colaborador.department}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onManageAuth && (
              <button
                onClick={() => {
                  onClose()
                  onManageAuth(colaborador)
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors shadow-sm"
                title="Atribuir / Alterar Credenciais de Acesso"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Credenciais & Password</span>
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => {
                  onClose()
                  onEdit(colaborador)
                }}
                className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                title="Editar Colaborador"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Contacts Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-sm">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Email Institucional</span>
                  <a href={`mailto:${colaborador.email}`} className="text-sm font-semibold text-slate-800 hover:text-green-700">
                    {colaborador.email}
                  </a>
                </div>
              </div>
              <button
                onClick={handleCopyEmail}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                title="Copiar email"
              >
                {copiedEmail ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-sm">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Contacto Telefónico</span>
                  <a href={`tel:${colaborador.phone}`} className="text-sm font-semibold text-slate-800 hover:text-green-700">
                    {colaborador.phone}
                  </a>
                </div>
              </div>
              <button
                onClick={handleCopyPhone}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                title="Copiar telefone"
              >
                {copiedPhone ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Institutional / Operational Info */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dados Operacionais & Contratuais</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-slate-500 block">Agência / Local de Trabalho:</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-green-600" />
                  {colaborador.agency_location}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-500 block">Data de Admissão:</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  {new Date(colaborador.admission_date).toLocaleDateString("pt-PT")}
                </span>
              </div>

              {colaborador.nif && (
                <div>
                  <span className="text-xs text-slate-500 block">NIF:</span>
                  <span className="font-mono font-semibold text-slate-800 mt-0.5 block">{colaborador.nif}</span>
                </div>
              )}

              {colaborador.emergency_contact && (
                <div>
                  <span className="text-xs text-slate-500 block">Contacto de Emergência:</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">{colaborador.emergency_contact}</span>
                </div>
              )}
            </div>
          </div>

          {/* Permissões & Competências */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <Key className="w-4 h-4 text-amber-600" />
              <span>Permissões & Competências Atribuídas</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {colaborador.permissions.map((perm, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                  {perm}
                </span>
              ))}
            </div>
          </div>

          {/* Notas / Observações */}
          {colaborador.notes && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Observações
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">{colaborador.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            Membro da Equipa Linke Logistics
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
