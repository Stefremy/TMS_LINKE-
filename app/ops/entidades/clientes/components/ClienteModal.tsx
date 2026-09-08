"use client"

import * as React from "react"
import { 
  X, 
  Save, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  CreditCard, 
  Palette, 
  Loader2,
  CheckCircle2,
  Euro,
  FileText,
  User,
  ShieldAlert,
  ExternalLink,
  LayoutDashboard
} from "lucide-react"
import { saveClienteAction } from "@/app/actions/clientes"
import { 
  Cliente, 
  DEFAULT_CLIENT_CATEGORIES, 
  CLIENT_COLOR_OPTIONS 
} from "../types"

interface ClienteModalProps {
  initialData?: Cliente | null
  onClose: () => void
  onSaved: (saved: Cliente) => void
}

export function ClienteModal({ initialData, onClose, onSaved }: ClienteModalProps) {
  const [isSaving, setIsSaving] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<"geral" | "faturacao" | "contactos" | "comercial">("geral")
  const [saveSuccessMsg, setSaveSuccessMsg] = React.useState(false)

  const [formData, setFormData] = React.useState<Partial<Cliente>>({
    code: initialData?.code || `CL${Math.floor(100 + Math.random() * 900)}`,
    short_name: initialData?.short_name || "",
    legal_name: initialData?.legal_name || "",
    color: initialData?.color || "#10b981",
    nif: initialData?.nif || "",
    category: initialData?.category || "Cliente Conta Corrente",
    city: initialData?.city || "",
    address: initialData?.address || "",
    postal_code: initialData?.postal_code || "",
    country_code: initialData?.country_code || "PT",
    email: initialData?.email || "",
    billing_email: initialData?.billing_email || "",
    phone: initialData?.phone || "",
    mobile_phone: initialData?.mobile_phone || "",
    manager_name: initialData?.manager_name || "",
    billing_agency: initialData?.billing_agency || "A01 - Sede Guimarães",
    payment_terms: initialData?.payment_terms || "A 30 dias",
    iban: initialData?.iban || "",
    credit_limit: initialData?.credit_limit ?? 5000,
    balance: initialData?.balance || "0,00€",
    assigned_seller: initialData?.assigned_seller || "Gestão Comercial",
    observations: initialData?.observations || "",
    is_active: initialData?.is_active ?? true,
    created_at: initialData?.created_at || new Date().toISOString(),
  })

  React.useEffect(() => {
    if (initialData) {
      setFormData({
        code: initialData.code || "",
        short_name: initialData.short_name || "",
        legal_name: initialData.legal_name || "",
        color: initialData.color || "#10b981",
        nif: initialData.nif || "",
        category: initialData.category || "Cliente Conta Corrente",
        city: initialData.city || "",
        address: initialData.address || "",
        postal_code: initialData.postal_code || "",
        country_code: initialData.country_code || "PT",
        email: initialData.email || "",
        billing_email: initialData.billing_email || "",
        phone: initialData.phone || "",
        mobile_phone: initialData.mobile_phone || "",
        manager_name: initialData.manager_name || "",
        billing_agency: initialData.billing_agency || "A01 - Sede Guimarães",
        payment_terms: initialData.payment_terms || "A 30 dias",
        iban: initialData.iban || "",
        credit_limit: initialData.credit_limit ?? 5000,
        balance: initialData.balance || "0,00€",
        assigned_seller: initialData.assigned_seller || "Gestão Comercial",
        observations: initialData.observations || "",
        is_active: initialData.is_active ?? true,
        created_at: initialData.created_at || new Date().toISOString(),
      })
    }
  }, [initialData])

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!formData.short_name?.trim()) {
      alert("Por favor preencha a Designação Curta / Nome do Cliente.")
      setActiveTab("geral")
      return
    }

    setIsSaving(true)
    try {
      const res = await saveClienteAction({
        ...formData,
        id: initialData?.id,
      })

      if (res.success && res.data) {
        setSaveSuccessMsg(true)
        onSaved(res.data)
        setTimeout(() => {
          onClose()
        }, 300)
      }
    } catch (err: any) {
      alert("Erro ao gravar cliente: " + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-300">
        
        {/* ===================== OVERVIEW HEADER ===================== */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div 
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm shrink-0"
              style={{ backgroundColor: formData.color || "#10b981" }}
            >
              {formData.short_name ? formData.short_name.substring(0, 2).toUpperCase() : <Building2 className="w-6 h-6" />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  {formData.short_name || (initialData ? "Editar Cliente" : "Novo Cliente")}
                </h1>
                
                <span className="bg-slate-100 border border-slate-300 text-slate-700 text-xs font-mono font-bold px-2 py-0.5 rounded">
                  {formData.code || "CL000"}
                </span>

                <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  {formData.category || "Cliente Conta Corrente"}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                <span className="text-slate-700 font-medium">
                  {formData.legal_name || "Designação Social / Fiscal"}
                </span>
                <span>•</span>
                <span>NIF: <strong>{formData.nif || "—"}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Redirect to Client Store / Portal UI */}
            <a
              href={`/app?clientId=${encodeURIComponent(formData.id || "")}&clientName=${encodeURIComponent(formData.short_name || "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              title="Aceder à loja / portal do cliente para criar novos envios e pedidos"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Aceder à Loja do Cliente (Criar Envios)</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ===================== TABS NAVIGATION ===================== */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-6 shrink-0 overflow-x-auto">
          {[
            { id: "geral", label: "Identidade & Classificação", icon: Building2 },
            { id: "faturacao", label: "Moradas & Faturação", icon: MapPin },
            { id: "contactos", label: "Contactos", icon: Phone },
            { id: "comercial", label: "Condições & Crédito", icon: Euro },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "border-emerald-600 text-emerald-700 bg-white shadow-xs rounded-t-lg"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-emerald-600" : "text-slate-400"}`} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* ===================== FORM CONTENT ===================== */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/40">
          
          {/* TAB 1: IDENTIDADE & GERAL */}
          {activeTab === "geral" && (
            <div className="space-y-5 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
              
              {/* Quick Store / Portal Access Banner */}
              <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <LayoutDashboard className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-950 flex items-center gap-2">
                      <span>Loja & Portal de Envios do Cliente</span>
                      <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded">Área de Cliente</span>
                    </div>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      Acesso direto à loja/portal deste cliente onde poderá emitir novas guias de transporte, pedir recolhas e gerir envios.
                    </p>
                  </div>
                </div>
                <a
                  href={`/app?clientId=${encodeURIComponent(formData.id || "")}&clientName=${encodeURIComponent(formData.short_name || "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Entrar na Loja (Criar Envios)</span>
                </a>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Código Cliente *</label>
                  <input
                    type="text"
                    required
                    value={formData.code || ""}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 uppercase focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="CL001"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Designação Curta / Nome Comercial *</label>
                  <input
                    type="text"
                    required
                    value={formData.short_name || ""}
                    onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="Ex: CACTO"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Designação Social / Razão Social</label>
                <input
                  type="text"
                  value={formData.legal_name || ""}
                  onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="Ex: Cacto Moda & Acessórios, Lda"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">NIF / NIPC</label>
                  <input
                    type="text"
                    value={formData.nif || ""}
                    onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="514987123"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Categoria de Cliente</label>
                  <select
                    value={formData.category || "Cliente Conta Corrente"}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {DEFAULT_CLIENT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Color Tag Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-slate-500" />
                  Cor de Identificação Rápida
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {CLIENT_COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: c.value })}
                      className={`w-7 h-7 rounded-lg transition-transform cursor-pointer flex items-center justify-center border ${
                        formData.color === c.value ? "ring-2 ring-emerald-500 ring-offset-2 scale-110 border-white shadow-xs" : "border-transparent opacity-80 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                  <input
                    type="color"
                    value={formData.color || "#10b981"}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-7 h-7 rounded-lg border border-slate-300 cursor-pointer p-0"
                    title="Cor personalizada"
                  />
                </div>
              </div>

              {/* Estado Switch */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800">Estado da Entidade</span>
                  <p className="text-[11px] text-slate-500">Clientes ativos podem emitir envios e recolhas no portal</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active ?? true}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  <span className="ml-2 text-xs font-bold text-slate-700">
                    {formData.is_active ? "Ativo" : "Inativo"}
                  </span>
                </label>
              </div>

            </div>
          )}

          {/* TAB 2: FATURAÇÃO & MORADAS */}
          {activeTab === "faturacao" && (
            <div className="space-y-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Morada de Faturação</label>
                <input
                  type="text"
                  value={formData.address || ""}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="Rua, Avenida, Número, Andar..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Código Postal</label>
                  <input
                    type="text"
                    value={formData.postal_code || ""}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="4800-000"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Localidade / Cidade</label>
                  <input
                    type="text"
                    value={formData.city || ""}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="Ex: Guimarães"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">País</label>
                  <select
                    value={formData.country_code || "PT"}
                    onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="PT">Portugal (PT)</option>
                    <option value="ES">Espanha (ES)</option>
                    <option value="FR">França (FR)</option>
                    <option value="DE">Alemanha (DE)</option>
                    <option value="OUTRO">Outro / Internacional</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Condições de Pagamento</label>
                  <select
                    value={formData.payment_terms || "A 30 dias"}
                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="Pronto Pagamento">Pronto Pagamento</option>
                    <option value="A 15 dias">A 15 dias</option>
                    <option value="A 30 dias">A 30 dias</option>
                    <option value="A 60 dias">A 60 dias</option>
                    <option value="Débito Direto">Débito Direto (SEPA)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Agência Linke de Faturação</label>
                  <select
                    value={formData.billing_agency || "A01 - Sede Guimarães"}
                    onChange={(e) => setFormData({ ...formData, billing_agency: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="A01 - Sede Guimarães">A01 - Sede Guimarães</option>
                    <option value="A02 - Lisboa">A02 - Lisboa</option>
                    <option value="A03 - Porto">A03 - Porto</option>
                    <option value="A04 - Algarve">A04 - Algarve</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">IBAN de Cobrança / Reembolsos</label>
                <input
                  type="text"
                  value={formData.iban || ""}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="PT50 0000 0000 0000 0000 0000 0"
                />
              </div>

            </div>
          )}

          {/* TAB 3: CONTACTOS */}
          {activeTab === "contactos" && (
            <div className="space-y-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Telefone Fixo</label>
                  <input
                    type="tel"
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="253 000 000"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Telemóvel / Operações</label>
                  <input
                    type="tel"
                    value={formData.mobile_phone || ""}
                    onChange={(e) => setFormData({ ...formData, mobile_phone: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="910 000 000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Geral / Notificações</label>
                  <input
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="encomendas@cliente.pt"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email de Faturação / Financeiro</label>
                  <input
                    type="email"
                    value={formData.billing_email || ""}
                    onChange={(e) => setFormData({ ...formData, billing_email: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="faturacao@cliente.pt"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Pessoa de Contacto / Responsável</label>
                <input
                  type="text"
                  value={formData.manager_name || ""}
                  onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="Nome do interlocutor principal"
                />
              </div>

            </div>
          )}

          {/* TAB 4: CONDIÇÕES & CRÉDITO */}
          {activeTab === "comercial" && (
            <div className="space-y-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Plafond / Limite de Crédito (€)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="100"
                      min="0"
                      value={formData.credit_limit ?? 5000}
                      onChange={(e) => setFormData({ ...formData, credit_limit: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold font-mono text-slate-900 pr-7 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">€</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Responsável Comercial</label>
                  <input
                    type="text"
                    value={formData.assigned_seller || ""}
                    onChange={(e) => setFormData({ ...formData, assigned_seller: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="Ex: Gestão Comercial Norte"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Observações Internas / Regras Operacionais</label>
                <textarea
                  rows={4}
                  value={formData.observations || ""}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none leading-relaxed"
                  placeholder="Instruções especiais de recolha, SLA contratado, janelas horárias específicas..."
                />
              </div>

            </div>
          )}

        </div>

        {/* ===================== FOOTER ACTION BAR ===================== */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            {saveSuccessMsg && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Cliente gravado com sucesso!
              </span>
            )}
            <span className="text-xs text-slate-400 hidden sm:inline">
              Linke TMS Core • Entidade Cliente: <strong>{formData.code}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white px-5 py-2 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {initialData ? "Atualizar Cliente" : "Gravar Novo Cliente"}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
