"use client"

import * as React from "react"
import { X, Save, Building2, Phone, Mail, MapPin, CreditCard, ShieldCheck, Palette, Loader2 } from "lucide-react"
import { Fornecedor, saveFornecedorAction } from "@/app/actions/fornecedores"

interface FornecedorModalProps {
  initialData?: Fornecedor | null
  onClose: () => void
  onSaved: (saved: Fornecedor) => void
}

const COLOR_OPTIONS = [
  { label: "Azul Ciano", value: "#00a3e0" },
  { label: "Vermelho", value: "#dc2626" },
  { label: "Azul Marinho", value: "#1e3a8a" },
  { label: "Salmão / Laranja", value: "#f87171" },
  { label: "Azul Céu", value: "#38bdf8" },
  { label: "Verde Esmeralda", value: "#059669" },
  { label: "Roxo", value: "#7c3aed" },
  { label: "Cinza", value: "#475569" },
]

export function FornecedorModal({ initialData, onClose, onSaved }: FornecedorModalProps) {
  const [isSaving, setIsSaving] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<"geral" | "fiscal" | "contactos" | "comercial">("geral")

  const [formData, setFormData] = React.useState<Partial<Fornecedor>>({
    id: initialData?.id,
    code: initialData?.code || `LK00${Math.floor(Math.random() * 90 + 10)}`,
    center_code: initialData?.center_code || "A01",
    short_name: initialData?.short_name || "",
    color: initialData?.color || "#00a3e0",
    legal_name: initialData?.legal_name || "",
    nif: initialData?.nif || "",
    role: initialData?.role || "Transportador Subcontratado",
    city: initialData?.city || "",
    email: initialData?.email || "",
    phone: initialData?.phone || "",
    balance: initialData?.balance || "0,00€",
    payment_terms: initialData?.payment_terms || "A 30 dias",
    is_active: initialData?.is_active ?? true,
    country_code: initialData?.country_code || "PT",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.short_name?.trim()) {
      alert("Por favor preencha a Designação Curta do fornecedor.")
      return
    }

    setIsSaving(true)
    try {
      const res = await saveFornecedorAction(formData)
      if (res.success) {
        onSaved(res.data)
        onClose()
      }
    } catch (err: any) {
      alert("Erro ao gravar fornecedor: " + (err.message || "Tente novamente."))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold shadow-xs"
              style={{ backgroundColor: formData.color }}
            >
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {initialData ? "Editar Fornecedor" : "Novo Fornecedor"}
              </h2>
              <p className="text-xs text-slate-500">
                {formData.legal_name || formData.short_name || "Parceiro de transporte"}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="px-6 border-b border-slate-200 bg-white flex gap-6 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("geral")}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === "geral" ? "border-green-600 text-green-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Identificação
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("fiscal")}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === "fiscal" ? "border-green-600 text-green-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Fiscal & Morada
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("contactos")}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === "contactos" ? "border-green-600 text-green-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Contactos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("comercial")}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === "comercial" ? "border-green-600 text-green-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Comercial & Saldo
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {activeTab === "geral" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Código Interno *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-mono focus:ring-2 focus:ring-green-500 focus:outline-none"
                    placeholder="Ex: LK004"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Armazém / Centro</label>
                  <input
                    type="text"
                    value={formData.center_code}
                    onChange={(e) => setFormData({ ...formData, center_code: e.target.value })}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-mono focus:ring-2 focus:ring-green-500 focus:outline-none"
                    placeholder="Ex: A01"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Tipo de Fornecedor</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-green-500 focus:outline-none"
                  >
                    <option value="Transportador Subcontratado">Transportador Subcontratado</option>
                    <option value="Transportador Próprio">Transportador Próprio</option>
                    <option value="Operador Logístico">Operador Logístico</option>
                    <option value="Distribuição Postal">Distribuição Postal</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Designação Curta *</label>
                  <input
                    type="text"
                    required
                    value={formData.short_name}
                    onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-bold focus:ring-2 focus:ring-green-500 focus:outline-none"
                    placeholder="Ex: CTT Expresso, DPD, GLS"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Cor do Marcador Visual</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-10 h-9 p-0.5 rounded border border-slate-300 cursor-pointer"
                    />
                    <div className="flex gap-1.5 flex-1">
                      {COLOR_OPTIONS.slice(0, 5).map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, color: c.value })}
                          className={`w-6 h-6 rounded-full border-2 transition-transform ${
                            formData.color === c.value ? "scale-110 border-slate-800" : "border-transparent"
                          }`}
                          style={{ backgroundColor: c.value }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">Designação Social (Razão Social)</label>
                <input
                  type="text"
                  value={formData.legal_name}
                  onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-green-500 focus:outline-none"
                  placeholder="Ex: CTT EXPRESSO SERVIÇOS POSTAIS E LOGÍSTICA, S.A."
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-sm font-bold text-slate-800 block">Estado do Fornecedor</span>
                  <span className="text-xs text-slate-500">Permite associar em webservices e atribuir envios</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 cursor-pointer ${
                    formData.is_active ? "bg-green-600 justify-end" : "bg-slate-300 justify-start"
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                </button>
              </div>
            </div>
          )}

          {activeTab === "fiscal" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">NIF / Número de Contribuinte</label>
                  <input
                    type="text"
                    value={formData.nif}
                    onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-mono focus:ring-2 focus:ring-green-500 focus:outline-none"
                    placeholder="Ex: 504520296"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">País</label>
                  <select
                    value={formData.country_code}
                    onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-green-500 focus:outline-none"
                  >
                    <option value="PT">Portugal (PT)</option>
                    <option value="ES">Espanha (ES)</option>
                    <option value="FR">França (FR)</option>
                    <option value="EU">Outro União Europeia</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">Localidade / Cidade</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-green-500 focus:outline-none"
                  placeholder="Ex: LISBOA, MAIA, PORTO"
                />
              </div>
            </div>
          )}

          {activeTab === "contactos" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    Telefone Operacional
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-green-500 focus:outline-none"
                    placeholder="Ex: 926388679"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    Email Operacional
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-green-500 focus:outline-none"
                    placeholder="Ex: operacoes@transportadora.pt"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "comercial" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Saldo Atual em Conta Corrente</label>
                  <input
                    type="text"
                    value={formData.balance}
                    onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-green-700 font-bold focus:ring-2 focus:ring-green-500 focus:outline-none"
                    placeholder="0,00€"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">Condições de Pagamento</label>
                  <select
                    value={formData.payment_terms}
                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-green-500 focus:outline-none"
                  >
                    <option value="A 30 dias">A 30 dias</option>
                    <option value="A 60 dias">A 60 dias</option>
                    <option value="A 90 dias">A 90 dias</option>
                    <option value="A Pronto">A Pronto</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {initialData ? "Atualizar Fornecedor" : "Gravar Fornecedor"}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
