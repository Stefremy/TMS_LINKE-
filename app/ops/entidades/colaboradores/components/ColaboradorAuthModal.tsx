"use client"

import * as React from "react"
import {
  X,
  Key,
  Shield,
  Eye,
  EyeOff,
  Copy,
  Check,
  Sparkles,
  Loader2,
  CheckCircle2,
  Lock,
  UserCheck
} from "lucide-react"
import { Colaborador, ACCESS_LEVELS, AVAILABLE_PERMISSIONS } from "../types"
import { setColaboradorCredentialsAction } from "@/app/actions/auth"
import { saveColaboradorAction } from "@/app/actions/colaboradores"

interface ColaboradorAuthModalProps {
  isOpen: boolean
  onClose: () => void
  colaborador: Colaborador
  onUpdated?: (updated: Colaborador) => void
}

export function ColaboradorAuthModal({
  isOpen,
  onClose,
  colaborador,
  onUpdated,
}: ColaboradorAuthModalProps) {
  const [email, setEmail] = React.useState(colaborador.email || "")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [accessLevel, setAccessLevel] = React.useState<"Administrador" | "Operacional" | "Comercial / Suporte">(
    colaborador.access_level || "Operacional"
  )
  const [selectedPermissions, setSelectedPermissions] = React.useState<string[]>(
    colaborador.permissions || []
  )

  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState("")
  const [success, setSuccess] = React.useState("")
  const [copiedCredentials, setCopiedCredentials] = React.useState(false)

  React.useEffect(() => {
    setEmail(colaborador.email || "")
    setAccessLevel(colaborador.access_level || "Operacional")
    setSelectedPermissions(colaborador.permissions || [])
    setPassword("")
    setError("")
    setSuccess("")
  }, [colaborador, isOpen])

  if (!isOpen) return null

  // Generate strong random password
  const handleGeneratePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*"
    let generated = ""
    for (let i = 0; i < 12; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setPassword(generated)
    setShowPassword(true)
  }

  // Toggle permission
  const handleTogglePermission = (perm: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    )
  }

  // Copy credentials message
  const handleCopyCredentials = () => {
    const text = `Credenciais de Acesso TMS Linke Logistics:
Colaborador: ${colaborador.name}
Email de Login: ${email}
Password: ${password || "[A password atual do colaborador]"}
Nível de Acesso: ${accessLevel}
Permissões: ${selectedPermissions.join(", ")}
Link de Acesso: http://localhost:3000/ops`

    navigator.clipboard.writeText(text)
    setCopiedCredentials(true)
    setTimeout(() => setCopiedCredentials(false), 2500)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      // 1. Set credentials in auth
      const authRes = await setColaboradorCredentialsAction(
        colaborador.id,
        email.trim(),
        password.trim() || undefined,
        accessLevel,
        selectedPermissions
      )

      // 2. Update employee profile
      const saveRes = await saveColaboradorAction({
        ...colaborador,
        email: email.trim(),
        access_level: accessLevel,
        permissions: selectedPermissions,
      })

      if (saveRes.success && saveRes.colaborador && onUpdated) {
        onUpdated(saveRes.colaborador)
      }

      setSuccess(authRes.message)
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err: any) {
      setError(err?.message || "Ocorreu um erro ao atribuir credenciais.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-[var(--surface-bg)] rounded-2xl shadow-2xl border border-[var(--border-subtle)] w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--surface-muted)]">
          <div className="flex items-center gap-3">
            {colaborador.avatar ? (
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-2xs shrink-0 border border-[var(--border-subtle)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={colaborador.avatar} alt={colaborador.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div
                className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold shadow-2xs shrink-0"
                style={{ backgroundColor: colaborador.avatar_color || "#16a34a" }}
              >
                {colaborador.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Acesso & Credenciais de Login
              </h2>
              <p className="text-xs text-[var(--text-tertiary)]">
                {colaborador.name} &bull; <span className="font-mono">{colaborador.code}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-dim)] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 text-xs text-[var(--status-error)] bg-[var(--status-error-soft)] border border-[rgba(220,38,38,0.2)] rounded-xl font-medium">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 text-xs text-[var(--status-success)] bg-[var(--status-success-soft)] border border-[rgba(18,138,71,0.25)] rounded-xl font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[var(--accent)]" />
              <span>{success}</span>
            </div>
          )}

          {/* Email de Login */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
              Email de Login *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl text-sm focus:bg-[var(--surface-bg)] focus:ring-2 focus:ring-[var(--accent)] focus:outline-none font-medium text-[var(--text-primary)]"
              placeholder="colaborador@linkelogistics.pt"
            />
            <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Email utilizado para autenticação no portal TMS Linke.</p>
          </div>

          {/* Password com Gerador */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[var(--text-primary)]">
                Password / Palavra-passe
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Gerar Password Segura
              </button>
            </div>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Introduza uma nova password ou deixe vazio para manter a atual"
                className="w-full pl-3.5 pr-10 py-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl text-sm focus:bg-[var(--surface-bg)] focus:ring-2 focus:ring-[var(--accent)] focus:outline-none font-mono text-[var(--text-primary)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Nível de Acesso */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-primary)] mb-2">
              Nível de Acesso (Perfil)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {ACCESS_LEVELS.map((level) => {
                const isSelected = accessLevel === level
                return (
                  <div
                    key={level}
                    onClick={() => setAccessLevel(level)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-[var(--accent-soft)] border-[var(--accent)] ring-2 ring-[var(--accent)]/20"
                        : "bg-[var(--surface-muted)] border-[var(--border-subtle)] hover:bg-[var(--surface-dim)]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isSelected ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}`}>
                        {level}
                      </span>
                      {isSelected && <Shield className="w-3.5 h-3.5 text-[var(--accent)]" />}
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-1 leading-tight">
                      {level === "Administrador"
                        ? "Acesso total à gestão, clientes, finanças e configurações."
                        : level === "Operacional"
                        ? "Operações de transporte, guias CTT, recolhas e tracking."
                        : "Gestão comercial, apoio a clientes e incidências."}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Permissões Granulares */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-[var(--text-primary)]">
                Módulos e Permissões Granulares
              </label>
              <span className="text-[10px] text-[var(--text-tertiary)]">
                Selecione as permissões ativas
              </span>
            </div>
            <div className="space-y-2 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl p-3">
              {AVAILABLE_PERMISSIONS.map((perm) => {
                const isChecked = selectedPermissions.includes(perm)
                const isSalariosPerm = perm === "Gestão de Salários & Vencimentos"
                const isSuperAdminPerm = perm === "Acesso Total (Super-Admin)"

                return (
                  <label
                    key={perm}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                      isChecked ? "bg-[var(--surface-bg)] shadow-2xs" : "hover:bg-[var(--surface-dim)]/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 text-xs text-[var(--text-primary)]">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleTogglePermission(perm)}
                        className="w-4 h-4 rounded cursor-pointer accent-[var(--accent)]"
                      />
                      <span className={`text-xs ${isSuperAdminPerm ? "font-bold text-[var(--text-primary)]" : "font-medium"}`}>
                        {perm}
                      </span>
                    </div>

                    {isSalariosPerm && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--status-warning-soft)] text-[var(--status-warning)] border border-[rgba(217,119,6,0.2)]">
                        <Lock className="w-2.5 h-2.5" />
                        Área Restrita (/ops/tesouraria/salarios)
                      </span>
                    )}

                    {isSuperAdminPerm && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--accent-soft)] text-[var(--accent)] border border-[rgba(18,138,71,0.2)]">
                        <Shield className="w-2.5 h-2.5" />
                        Acesso Geral
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </div>

          {/* Copiar Credenciais formatadas */}
          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handleCopyCredentials}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] bg-[var(--surface-muted)] hover:bg-[var(--surface-dim)] border border-[var(--border-subtle)] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              {copiedCredentials ? <Check className="w-3.5 h-3.5 text-[var(--accent)]" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCredentials ? "Credenciais Copiadas!" : "Copiar Dados de Acesso"}
            </button>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-xl hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-5 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-60 transition-colors cursor-pointer"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Gravar Acessos & Credenciais
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
