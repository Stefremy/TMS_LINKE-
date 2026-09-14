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
import { Colaborador, ACCESS_LEVELS } from "../types"
import { setColaboradorCredentialsAction } from "@/app/actions/auth"
import { saveColaboradorAction } from "@/app/actions/colaboradores"

interface ColaboradorAuthModalProps {
  isOpen: boolean
  onClose: () => void
  colaborador: Colaborador
  onUpdated?: (updated: Colaborador) => void
}

const AVAILABLE_PERMISSIONS = [
  "Acesso Total (Super-Admin)",
  "Gestão de Clientes & Contratos",
  "Emissão e Controlo de Guias CTT",
  "Pedidos de Recolha & Distribuição",
  "Faturação & Contas Correntes",
  "Gestão de Transportadoras & Frotas",
  "Configurações de Webservices & Integrações",
]

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/75">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shadow-sm">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Acesso & Credenciais de Login
              </h2>
              <p className="text-xs text-slate-500">
                {colaborador.name} &bull; <span className="font-mono">{colaborador.code}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl font-medium">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          {/* Email de Login */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email de Login *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-green-500 focus:outline-none font-medium"
              placeholder="colaborador@linkelogistics.pt"
            />
            <p className="text-[11px] text-slate-400 mt-1">Email utilizado para autenticação no portal TMS Linke.</p>
          </div>

          {/* Password com Gerador */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Password / Palavra-passe
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-800"
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
                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-green-500 focus:outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Nível de Acesso */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
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
                        ? "bg-blue-50/70 border-blue-500 ring-2 ring-blue-100"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100/70"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isSelected ? "text-blue-900" : "text-slate-700"}`}>
                        {level}
                      </span>
                      {isSelected && <Shield className="w-3.5 h-3.5 text-blue-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-tight">
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
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Módulos e Permissões Granulares
            </label>
            <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
              {AVAILABLE_PERMISSIONS.map((perm) => {
                const isChecked = selectedPermissions.includes(perm)
                return (
                  <label
                    key={perm}
                    className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer hover:text-slate-900"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleTogglePermission(perm)}
                      className="w-4 h-4 text-green-600 rounded border-slate-300 focus:ring-green-500"
                    />
                    <span className="font-medium">{perm}</span>
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
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              {copiedCredentials ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCredentials ? "Credenciais Copiadas!" : "Copiar Dados de Acesso"}
            </button>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-60 transition-colors"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Gravar Acesso
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
