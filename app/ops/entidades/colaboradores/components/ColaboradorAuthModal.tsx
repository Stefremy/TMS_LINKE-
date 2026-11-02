"use client"

import * as React from "react"
import {
  X,
  Eye,
  EyeOff,
  Copy,
  Check,
  Loader2,
  CheckCircle2,
  Lock,
} from "lucide-react"
import { RefreshIcon } from "@/components/ui/refresh-icon"
import { Colaborador } from "../types"
import { setColaboradorCredentialsAction } from "@/app/actions/auth"
import { StaffPermissionEditor } from "./StaffPermissionEditor"

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

  /* eslint-disable react-hooks/set-state-in-effect -- Reset the editable form when the selected account changes. */
  React.useEffect(() => {
    setEmail(colaborador.email || "")
    setAccessLevel(colaborador.access_level || "Operacional")
    setSelectedPermissions(colaborador.permissions || [])
    setPassword("")
    setError("")
    setSuccess("")
  }, [colaborador, isOpen])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!isOpen) return null

  // Generate strong random password
  const handleGeneratePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*"
    const random = crypto.getRandomValues(new Uint8Array(16))
    const generated = Array.from(random, value => chars[value % chars.length]).join("")
    setPassword(generated)
    setShowPassword(true)
  }

  // Copy credentials message
  const handleCopyCredentials = () => {
    const text = `Credenciais de Acesso TMS Linke Logistics:
Colaborador: ${colaborador.name}
Email de Login: ${email}
Password: ${password || "[A password atual do colaborador]"}
Nível de Acesso: ${accessLevel}
Permissões: ${selectedPermissions.join(", ")}
Link de Acesso: ${window.location.origin}/ops`

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

      if (authRes.colaborador && onUpdated) onUpdated(authRes.colaborador)

      setSuccess(authRes.message)
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ocorreu um erro ao atribuir credenciais.")
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
                style={{ backgroundColor: colaborador.avatar_color || "#477D68" }}
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
            <div className="p-3 text-xs text-[var(--status-critical)] bg-[var(--status-critical-soft)] border border-[rgba(220,38,38,0.2)] rounded-xl font-medium">
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
                <RefreshIcon className="w-4 h-4" />
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

          <StaffPermissionEditor level={accessLevel} permissions={selectedPermissions} email={email}
            onChange={(level, permissions) => { setAccessLevel(level); setSelectedPermissions(permissions) }} />

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
