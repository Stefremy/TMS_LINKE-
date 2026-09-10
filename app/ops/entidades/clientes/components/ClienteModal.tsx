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
  Truck,
  Layers,
  Percent,
  Check,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  Sliders,
  Tag,
  Clock,
  Plane,
  Anchor,
  HelpCircle,
  Zap,
  ShieldCheck,
  Package,
  UserCheck,
  SlidersHorizontal,
  ArrowRight,
  Upload,
  Image as ImageIcon
} from "lucide-react"
import { saveClienteAction } from "@/app/actions/clientes"
import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import { getCarrierLogo } from "@/lib/carrier-logos"
import { 
  Cliente, 
  DEFAULT_CLIENT_CATEGORIES, 
  CLIENT_COLOR_OPTIONS,
  DEFAULT_CLIENT_PRICING,
  DEFAULT_CTT_SERVICES_PRICING,
  DEFAULT_CTT_SPECIAL_SERVICES_FEES,
  ClientPricingConfig,
  ClientServicePrice,
  ClientSpecialServiceFee
} from "../types"

interface ClienteModalProps {
  initialData?: Cliente | null
  servicosLinke?: ServicoLinke[]
  onClose: () => void
  onSaved: (saved: Cliente) => void
}

type TabType = "geral" | "faturacao" | "contactos" | "comercial" | "precario"
type PrecarioSubTab = "servicos_linke" | "produtos" | "suplementares" | "geral"

export function ClienteModal({ initialData, servicosLinke = [], onClose, onSaved }: ClienteModalProps) {
  const [isSaving, setIsSaving] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<TabType>("geral")
  const [precarioSubTab, setPrecarioSubTab] = React.useState<PrecarioSubTab>("servicos_linke")
  const [saveSuccessMsg, setSaveSuccessMsg] = React.useState(false)

  // Initialize form data with rich pricing and webservices
  const [formData, setFormData] = React.useState<Partial<Cliente>>({
    code: initialData?.code || `CL${Math.floor(100 + Math.random() * 900)}`,
    short_name: initialData?.short_name || "",
    legal_name: initialData?.legal_name || "",
    color: initialData?.color || "#10b981",
    logo_url: initialData?.logo_url || "",
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
    default_linke_table_id: initialData?.default_linke_table_id || servicosLinke[0]?.id || "",
    assigned_linke_service_ids: initialData?.assigned_linke_service_ids || servicosLinke.map((s) => s.id),
    assigned_linke_profile: initialData?.assigned_linke_profile || "Standard / Geral",
    volume_discount_pct: initialData?.volume_discount_pct ?? 0,
    pricing: initialData?.pricing || DEFAULT_CLIENT_PRICING,
  })

  React.useEffect(() => {
    if (initialData) {
      setFormData({
        id: initialData.id,
        code: initialData.code || "",
        short_name: initialData.short_name || "",
        legal_name: initialData.legal_name || "",
        color: initialData.color || "#10b981",
        logo_url: initialData.logo_url || "",
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
        default_linke_table_id: initialData.default_linke_table_id || servicosLinke[0]?.id || "",
        assigned_linke_service_ids: initialData.assigned_linke_service_ids || servicosLinke.map((s) => s.id),
        assigned_linke_profile: initialData.assigned_linke_profile || "Standard / Geral",
        volume_discount_pct: initialData.volume_discount_pct ?? 0,
        pricing: {
          ...DEFAULT_CLIENT_PRICING,
          ...initialData.pricing,
          services_pricing: initialData.pricing?.services_pricing || DEFAULT_CTT_SERVICES_PRICING,
          special_services_fees: initialData.pricing?.special_services_fees || DEFAULT_CTT_SPECIAL_SERVICES_FEES,
        },
      })
    }
  }, [initialData, servicosLinke])

  // Handlers for Product Services Pricing
  const handleProductPriceChange = (index: number, field: keyof ClientServicePrice, value: any) => {
    setFormData((prev) => {
      const currentPricing = prev.pricing || DEFAULT_CLIENT_PRICING
      const currentList = currentPricing.services_pricing || DEFAULT_CTT_SERVICES_PRICING
      const updated = [...currentList]
      updated[index] = {
        ...updated[index],
        [field]: typeof value === "number" ? value : parseFloat(value) || 0,
      }
      return {
        ...prev,
        pricing: {
          ...currentPricing,
          services_pricing: updated,
        },
      }
    })
  }

  const handleToggleProductService = (index: number) => {
    setFormData((prev) => {
      const currentPricing = prev.pricing || DEFAULT_CLIENT_PRICING
      const currentList = currentPricing.services_pricing || DEFAULT_CTT_SERVICES_PRICING
      const updated = [...currentList]
      updated[index] = {
        ...updated[index],
        is_enabled: !updated[index].is_enabled,
      }
      return {
        ...prev,
        pricing: {
          ...currentPricing,
          services_pricing: updated,
        },
      }
    })
  }

  // Handlers for Special Services Fees
  const handleSpecialFeeChange = (index: number, field: keyof ClientSpecialServiceFee, value: any) => {
    setFormData((prev) => {
      const currentPricing = prev.pricing || DEFAULT_CLIENT_PRICING
      const currentList = currentPricing.special_services_fees || DEFAULT_CTT_SPECIAL_SERVICES_FEES
      const updated = [...currentList]
      updated[index] = {
        ...updated[index],
        [field]: typeof value === "boolean" ? value : typeof value === "string" && !isNaN(Number(value)) ? parseFloat(value) : value,
      }
      return {
        ...prev,
        pricing: {
          ...currentPricing,
          special_services_fees: updated,
        },
      }
    })
  }

  const handlePricingConfigChange = (field: keyof ClientPricingConfig, value: any) => {
    setFormData((prev) => {
      const currentPricing = prev.pricing || DEFAULT_CLIENT_PRICING
      return {
        ...prev,
        pricing: {
          ...currentPricing,
          [field]: value,
        },
      }
    })
  }

  const handleResetPricing = () => {
    if (confirm("Deseja repor todos os preços de produtos CTT e serviços especiais para os valores padrão oficiais?")) {
      setFormData((prev) => ({
        ...prev,
        pricing: DEFAULT_CLIENT_PRICING,
      }))
    }
  }


  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("A imagem selecionada não deve exceder 2MB.")
        return
      }
      const reader = new FileReader()
      reader.onload = (event) => {
        const result = event.target?.result as string
        if (result) {
          setFormData((prev) => ({ ...prev, logo_url: result }))
        }
      }
      reader.readAsDataURL(file)
    }
  }

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

  const servicesList = formData.pricing?.services_pricing || DEFAULT_CTT_SERVICES_PRICING
  const specialFeesList = formData.pricing?.special_services_fees || DEFAULT_CTT_SPECIAL_SERVICES_FEES

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-300">
        
        {/* ===================== OVERVIEW HEADER ===================== */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm shrink-0 overflow-hidden relative border border-slate-200"
              style={{ backgroundColor: formData.color || "#10b981" }}
            >
              {formData.logo_url ? (
                <img 
                  src={formData.logo_url} 
                  alt={formData.short_name || "Logo"} 
                  className="w-full h-full object-cover bg-white"
                />
              ) : (
                formData.short_name ? formData.short_name.substring(0, 2).toUpperCase() : <Building2 className="w-6 h-6" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight truncate">
                  {formData.short_name || (initialData ? "Editar Cliente" : "Novo Cliente")}
                </h1>
                
                <span className="bg-slate-100 border border-slate-300 text-slate-700 text-xs font-mono font-bold px-2 py-0.5 rounded shrink-0">
                  {formData.code || "CL000"}
                </span>

                <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0">
                  {formData.category || "Cliente Conta Corrente"}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 truncate">
                <span className="text-slate-700 font-medium truncate">
                  {formData.legal_name || "Designação Social / Fiscal"}
                </span>
                <span>•</span>
                <span>NIF: <strong>{formData.nif || "—"}</strong></span>
                <span>•</span>
                <span className="text-emerald-700 font-medium">
                  {servicesList.filter(s => s.is_enabled).length} Serviços CTT Ativos
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Redirect to Client Store / Portal UI */}
            <a
              href={`/app?clientId=${encodeURIComponent(formData.id || "")}&clientName=${encodeURIComponent(formData.short_name || "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              title="Aceder à loja / portal do cliente para criar novos envios e pedidos"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Aceder à Loja (Criar Envios)</span>
              <span className="sm:hidden">Loja</span>
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
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-4 sm:px-6 shrink-0 overflow-x-auto">
          {[
            { id: "geral", label: "Identidade & Geral", icon: Building2 },
            { id: "faturacao", label: "Moradas & Faturação", icon: MapPin },
            { id: "contactos", label: "Contactos", icon: Phone },
            { id: "comercial", label: "Condições & Crédito", icon: Euro },
            { id: "precario", label: "Preçário de Envio (CTT)", icon: Percent, badge: `${servicesList.filter(s => s.is_enabled).length} Produtos` },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`py-3 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "border-emerald-600 text-emerald-700 bg-white shadow-xs rounded-t-lg"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-emerald-600" : "text-slate-400"}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                    isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ===================== FORM CONTENT ===================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/40">
          
          {/* TAB 1: IDENTIDADE & GERAL */}
          {activeTab === "geral" && (
            <div className="space-y-5 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
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
                    placeholder="Ex: CACTO ou DETAILER"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Designação Social / Razão Fiscal</label>
                  <input
                    type="text"
                    value={formData.legal_name || ""}
                    onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="Ex: Cacto Moda & Acessórios, Lda"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">NIF / Número Fiscal</label>
                  <input
                    type="text"
                    value={formData.nif || ""}
                    onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="514987123"
                  />
                </div>
              </div>

              {/* Foto / Logótipo da Marca ou Loja */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4">
                <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Foto / Logótipo da Marca ou Loja</span>
                  <span className="text-[10px] text-slate-400 font-normal">(Permite distinguir visualmente o cliente)</span>
                </label>
                <div className="flex flex-wrap items-center gap-4">
                  <div 
                    className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-xs shrink-0 overflow-hidden border-2 relative"
                    style={{ 
                      borderColor: formData.color || "#10b981",
                      backgroundColor: formData.color || "#10b981"
                    }}
                  >
                    {formData.logo_url ? (
                      <img 
                        src={formData.logo_url} 
                        alt="Logo da Marca" 
                        className="w-full h-full object-cover bg-white"
                      />
                    ) : (
                      <span>{formData.short_name ? formData.short_name.substring(0, 2).toUpperCase() : <Building2 className="w-8 h-8" />}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-[240px] space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer">
                        <Upload className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Carregar Foto / Imagem</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>

                      {formData.logo_url && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, logo_url: "" })}
                          className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          title="Remover foto da marca"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remover Foto</span>
                        </button>
                      )}
                    </div>

                    <div>
                      <input
                        type="url"
                        value={formData.logo_url || ""}
                        onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                        placeholder="Ou cole o URL direto da imagem (ex: https://.../logo.png)"
                        className="w-full border border-slate-300 bg-white rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <p className="text-[11px] text-slate-400">
                      Formatos aceites: PNG, JPG, SVG ou WebP. A foto é usada no TMS, nos mapas e no portal deste cliente.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Categoria de Cliente</label>
                  <select
                    value={formData.category || "Cliente Conta Corrente"}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {DEFAULT_CLIENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cor Identificadora no TMS</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.color || "#10b981"}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-9 h-9 p-0.5 rounded-lg border border-slate-300 cursor-pointer"
                    />
                    <select
                      value={formData.color || "#10b981"}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      {CLIENT_COLOR_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>{c.label} ({c.value})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Observações Internas / Regras Operacionais</label>
                <textarea
                  rows={3}
                  value={formData.observations || ""}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  placeholder="Horários de recolha, exigências de etiquetagem, instruções para motoristas..."
                  className="w-full border border-slate-300 rounded-lg p-3 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="client_active"
                  checked={formData.is_active ?? true}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="client_active" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Cliente Ativo (Pode emitir guias e realizar envios)
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: MORADAS & FATURAÇÃO */}
          {activeTab === "faturacao" && (
            <div className="space-y-5 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                Morada Principal e Agência de Faturação
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Morada / Rua</label>
                  <input
                    type="text"
                    value={formData.address || ""}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="Avenida Dom Afonso Henriques, 45"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Código Postal</label>
                  <input
                    type="text"
                    value={formData.postal_code || ""}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="4800-043"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Localidade / Cidade</label>
                  <input
                    type="text"
                    value={formData.city || ""}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="Guimarães"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">País</label>
                  <select
                    value={formData.country_code || "PT"}
                    onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="PT">Portugal (PT)</option>
                    <option value="ES">Espanha (ES)</option>
                    <option value="FR">França (FR)</option>
                    <option value="DE">Alemanha (DE)</option>
                    <option value="UK">Reino Unido (UK)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Agência de Faturação Linke</label>
                  <select
                    value={formData.billing_agency || "A01 - Sede Guimarães"}
                    onChange={(e) => setFormData({ ...formData, billing_agency: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="A01 - Sede Guimarães">A01 - Sede Guimarães</option>
                    <option value="A02 - Lisboa Oriente">A02 - Lisboa Oriente</option>
                    <option value="A03 - Porto Maia">A03 - Porto Maia</option>
                    <option value="A04 - Coimbra Sul">A04 - Coimbra Sul</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email de Envio de Faturas</label>
                  <input
                    type="email"
                    value={formData.billing_email || ""}
                    onChange={(e) => setFormData({ ...formData, billing_email: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="financeiro@empresa.pt"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CONTACTOS */}
          {activeTab === "contactos" && (
            <div className="space-y-5 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                <Phone className="w-4 h-4 text-emerald-600" />
                Pessoas de Contacto & Comunicação
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Responsável / Gestor na Empresa</label>
                  <input
                    type="text"
                    value={formData.manager_name || ""}
                    onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="Ex: Rui Barbosa"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Geral / Operacional</label>
                  <input
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="encomendas@empresa.pt"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Telefone Fixo</label>
                  <input
                    type="text"
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="253512345"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Telemóvel / WhatsApp</label>
                  <input
                    type="text"
                    value={formData.mobile_phone || ""}
                    onChange={(e) => setFormData({ ...formData, mobile_phone: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="912345678"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CONDIÇÕES & CRÉDITO */}
          {activeTab === "comercial" && (
            <div className="space-y-5 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                <Euro className="w-4 h-4 text-emerald-600" />
                Condições Comerciais & Crédito
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Condição de Pagamento</label>
                  <select
                    value={formData.payment_terms || "A 30 dias"}
                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="Pronto Pagamento">Pronto Pagamento</option>
                    <option value="A 15 dias">A 15 dias</option>
                    <option value="A 30 dias">A 30 dias</option>
                    <option value="A 45 dias">A 45 dias</option>
                    <option value="A 60 dias">A 60 dias</option>
                    <option value="A 90 dias">A 90 dias</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Plafond de Crédito (€)</label>
                  <input
                    type="number"
                    value={formData.credit_limit ?? 5000}
                    onChange={(e) => setFormData({ ...formData, credit_limit: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="5000"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Comercial / Gestor de Conta</label>
                  <input
                    type="text"
                    value={formData.assigned_seller || ""}
                    onChange={(e) => setFormData({ ...formData, assigned_seller: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="Gestão Comercial Norte"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">IBAN para Débito Direto / Reembolsos</label>
                <input
                  type="text"
                  value={formData.iban || ""}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="PT50 0033 0000 8765 4321 0987 1"
                />
              </div>
            </div>
          )}

          {/* TAB 5: PREÇÁRIO DE ENVIO (PRODUTOS & SERVIÇOS ESPECIAIS CTT) */}
          {activeTab === "precario" && (
            <div className="space-y-4">
              
              {/* Top Sub-Tab Switcher */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setPrecarioSubTab("servicos_linke")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      precarioSubTab === "servicos_linke"
                        ? "bg-emerald-700 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>1. Tabelas Linke & Serviços Autorizados ({servicosLinke.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrecarioSubTab("produtos")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      precarioSubTab === "produtos"
                        ? "bg-white text-emerald-800 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>2. Tarifas por Escalão ({servicesList.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrecarioSubTab("suplementares")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      precarioSubTab === "suplementares"
                        ? "bg-white text-emerald-800 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>3. Taxas Especiais ({specialFeesList.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrecarioSubTab("geral")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      precarioSubTab === "geral"
                        ? "bg-white text-emerald-800 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5 text-slate-500" />
                    <span>4. Combustível & Descontos</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetPricing}
                    className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                    <span>Repor Valores Padrão</span>
                  </button>
                </div>
              </div>

              {/* SUBTAB 0: TABELAS LINKE & SERVIÇOS AUTORIZADOS (CAIXA SELECT) */}
              {precarioSubTab === "servicos_linke" && (
                <div className="space-y-4">
                  {/* Caixa Select de Tabela Linke Principal */}
                  <div className="bg-gradient-to-r from-emerald-50/80 via-white to-white p-5 rounded-xl border border-emerald-200 shadow-2xs space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-emerald-700" />
                          <h3 className="font-bold text-sm text-slate-900">
                            Caixa Select: Tabela de Preço Linke Associada ao Cliente
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Selecione o tarifário base para este cliente. Pode aplicar preços com desconto para clientes de grande volume.
                        </p>
                      </div>

                      {/* Select Box */}
                      <div className="min-w-[280px]">
                        <select
                          value={formData.default_linke_table_id || ""}
                          onChange={(e) => {
                            const tableId = e.target.value
                            const table = servicosLinke.find((s) => s.id === tableId)
                            setFormData((prev) => ({
                              ...prev,
                              default_linke_table_id: tableId,
                              assigned_linke_profile: table?.pricing_profile || "Standard / Geral",
                              volume_discount_pct: table?.discount_vs_standard_pct || 0,
                            }))
                          }}
                          className="w-full px-3.5 py-2 bg-white border-2 border-emerald-600 rounded-xl text-xs font-bold text-slate-800 shadow-xs focus:ring-2 focus:ring-emerald-500/20"
                        >
                          <option value="">-- Selecione a Tabela Linke --</option>
                          {servicosLinke.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.pricing_profile}) - {s.preferred_carrier_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Volume Discount Field */}
                    <div className="pt-3 border-t border-emerald-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-emerald-700" />
                        <span className="text-slate-700">
                          Perfil Selecionado: <strong className="text-emerald-800">{formData.assigned_linke_profile || "Standard / Geral"}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-slate-600 font-medium">Desconto de Volume Adicional:</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={formData.volume_discount_pct ?? 0}
                            onChange={(e) => setFormData({ ...formData, volume_discount_pct: parseFloat(e.target.value) || 0 })}
                            className="w-16 px-2 py-1 bg-white border border-slate-300 rounded text-center text-xs font-bold text-emerald-700"
                          />
                          <span className="font-bold text-slate-700">%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Grid de Serviços Linke Autorizados */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          Serviços Linke Autorizados para este Cliente ({formData.assigned_linke_service_ids?.length || 0} de {servicosLinke.length})
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Marque os serviços e parceiros que este cliente tem permissão para usar ao criar envios.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, assigned_linke_service_ids: servicosLinke.map((s) => s.id) })}
                          className="px-2.5 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          Selecionar Todos
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, assigned_linke_service_ids: [] })}
                          className="px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          Desmarcar Todos
                        </button>
                      </div>
                    </div>

                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {servicosLinke.map((servico) => {
                        const isAssigned = (formData.assigned_linke_service_ids || []).includes(servico.id)
                        const carrierLogo = getCarrierLogo(servico.preferred_carrier_name)
                        const firstZone = servico.zones?.[0]
                        const tier1 = firstZone?.tiers?.[0]
                        const tier5 = firstZone?.tiers?.find((t) => t.weight_max === 5) || firstZone?.tiers?.[1]

                        return (
                          <div
                            key={servico.id}
                            onClick={() => {
                              const current = formData.assigned_linke_service_ids || []
                              const next = isAssigned
                                ? current.filter((id) => id !== servico.id)
                                : [...current, servico.id]
                              setFormData({ ...formData, assigned_linke_service_ids: next })
                            }}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                              isAssigned
                                ? "bg-emerald-50/50 border-emerald-500 shadow-2xs ring-1 ring-emerald-500/20"
                                : "bg-white border-slate-200 hover:border-slate-300 opacity-60 hover:opacity-100"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={() => {}} // Handled by div onClick
                                className="mt-1 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />

                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {carrierLogo ? (
                                    <div className="w-6 h-6 rounded bg-white border border-slate-200 p-0.5 flex items-center justify-center shrink-0 overflow-hidden">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={carrierLogo} alt={servico.preferred_carrier_name} className="max-w-full max-h-full object-contain" />
                                    </div>
                                  ) : null}
                                  <span className="font-bold text-xs text-slate-900">{servico.name}</span>
                                </div>

                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] font-mono text-slate-500">{servico.code}</span>
                                  <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                                    {servico.pricing_profile}
                                  </span>
                                  <span className="text-[10px] text-slate-400">Trânsito: {servico.transit_time_label}</span>
                                </div>

                                {tier1 && (
                                  <div className="mt-2 text-[11px] text-slate-600 flex items-center gap-2 font-mono">
                                    <span>Até 1kg: <strong className="text-emerald-700">{tier1.sell_price.toFixed(2)}€</strong></span>
                                    {tier5 && <span>• Até 5kg: <strong className="text-emerald-700">{tier5.sell_price.toFixed(2)}€</strong></span>}
                                  </div>
                                )}
                              </div>
                            </div>

                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isAssigned ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                            }`}>
                              {isAssigned ? "Autorizado" : "Bloqueado"}
                            </span>
                          </div>
                        )
                      })}

                      {servicosLinke.length === 0 && (
                        <div className="col-span-2 p-8 text-center text-slate-400 text-xs">
                          Nenhum serviço Linke configurado. Configure serviços em Configuração &gt; Serviços Linke.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SUBTAB 1: PRODUTOS & SUB-PRODUTOS CTT */}
              {precarioSubTab === "produtos" && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                    <div>
                      <h2 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <Truck className="w-4 h-4 text-emerald-600" />
                        Tabela de Preços por Produto & Sub-Produto de Transporte (Valores em € sem IVA)
                      </h2>
                      <p className="text-[11px] text-slate-500">Defina a tarifa por escalão de peso para cada serviço contratado pelo cliente.</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold text-[11px]">
                          <th className="py-2.5 px-3 w-8 text-center">Ativo</th>
                          <th className="py-2.5 px-3 min-w-[220px]">Produto / Serviço (SubProductId)</th>
                          <th className="py-2.5 px-2 text-center w-20">Até 1kg</th>
                          <th className="py-2.5 px-2 text-center w-20">1 - 2kg</th>
                          <th className="py-2.5 px-2 text-center w-20">2 - 5kg</th>
                          <th className="py-2.5 px-2 text-center w-20">5 - 10kg</th>
                          <th className="py-2.5 px-2 text-center w-20">10 - 20kg</th>
                          <th className="py-2.5 px-2 text-center w-20">20 - 30kg</th>
                          <th className="py-2.5 px-2 text-center w-24">Kg Extra (€)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {servicesList.map((srv, idx) => (
                          <tr 
                            key={srv.service_code} 
                            className={`transition-colors ${srv.is_enabled ? "hover:bg-slate-50/70" : "bg-slate-50/50 opacity-60"}`}
                          >
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={srv.is_enabled}
                                onChange={() => handleToggleProductService(idx)}
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                            </td>

                            <td className="py-2.5 px-3 font-sans">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-900">{srv.service_name}</span>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full font-sans ${
                                    srv.category === "Nacional" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                                    srv.category === "Ilhas" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                    srv.category === "Espanha" ? "bg-rose-50 text-rose-700 border border-rose-200" :
                                    srv.category === "Postal" ? "bg-purple-50 text-purple-700 border border-purple-200" :
                                    "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  }`}>
                                    {srv.category}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-normal line-clamp-1">{srv.description}</span>
                              </div>
                            </td>

                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="0.01"
                                disabled={!srv.is_enabled}
                                value={srv.w_0_1}
                                onChange={(e) => handleProductPriceChange(idx, "w_0_1", e.target.value)}
                                className="w-full text-center border border-slate-200 rounded px-1.5 py-1 text-xs font-bold text-slate-900 bg-white disabled:bg-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                              />
                            </td>

                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="0.01"
                                disabled={!srv.is_enabled}
                                value={srv.w_1_2}
                                onChange={(e) => handleProductPriceChange(idx, "w_1_2", e.target.value)}
                                className="w-full text-center border border-slate-200 rounded px-1.5 py-1 text-xs font-bold text-slate-900 bg-white disabled:bg-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                              />
                            </td>

                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="0.01"
                                disabled={!srv.is_enabled}
                                value={srv.w_2_5}
                                onChange={(e) => handleProductPriceChange(idx, "w_2_5", e.target.value)}
                                className="w-full text-center border border-slate-200 rounded px-1.5 py-1 text-xs font-bold text-slate-900 bg-white disabled:bg-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                              />
                            </td>

                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="0.01"
                                disabled={!srv.is_enabled}
                                value={srv.w_5_10}
                                onChange={(e) => handleProductPriceChange(idx, "w_5_10", e.target.value)}
                                className="w-full text-center border border-slate-200 rounded px-1.5 py-1 text-xs font-bold text-slate-900 bg-white disabled:bg-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                              />
                            </td>

                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="0.01"
                                disabled={!srv.is_enabled}
                                value={srv.w_10_20}
                                onChange={(e) => handleProductPriceChange(idx, "w_10_20", e.target.value)}
                                className="w-full text-center border border-slate-200 rounded px-1.5 py-1 text-xs font-bold text-slate-900 bg-white disabled:bg-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                              />
                            </td>

                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="0.01"
                                disabled={!srv.is_enabled}
                                value={srv.w_20_30}
                                onChange={(e) => handleProductPriceChange(idx, "w_20_30", e.target.value)}
                                className="w-full text-center border border-slate-200 rounded px-1.5 py-1 text-xs font-bold text-slate-900 bg-white disabled:bg-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                              />
                            </td>

                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="0.01"
                                disabled={!srv.is_enabled}
                                value={srv.kg_extra}
                                onChange={(e) => handleProductPriceChange(idx, "kg_extra", e.target.value)}
                                className="w-full text-center border border-slate-200 rounded px-1.5 py-1 text-xs font-bold text-slate-900 bg-slate-50 disabled:bg-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SUBTAB 2: SERVIÇOS ESPECIAIS & SUPLEMENTARES (SpecialServices) */}
              {precarioSubTab === "suplementares" && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                    <div>
                      <h2 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        Tabela de Taxas Suplementares e Serviços Especiais (SpecialServices API CTT)
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        Valores cobrados ao cliente quando adiciona opções especiais de entrega aos seus envios.
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {specialFeesList.map((fee, idx) => (
                      <div 
                        key={fee.special_service_code}
                        className={`p-4 flex flex-wrap items-center justify-between gap-4 transition-colors ${
                          fee.is_enabled ? "hover:bg-slate-50/60" : "bg-slate-50/50 opacity-60"
                        }`}
                      >
                        <div className="flex items-start gap-3 max-w-lg">
                          <input
                            type="checkbox"
                            checked={fee.is_enabled}
                            onChange={(e) => handleSpecialFeeChange(idx, "is_enabled", e.target.checked)}
                            className="w-4 h-4 mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900">{fee.special_service_name}</span>
                              <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                                Tipo {fee.api_type_code}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">{fee.description}</p>
                          </div>
                        </div>

                        {/* Input controls based on fee type */}
                        <div className="flex items-center gap-3">
                          {fee.fee_type === "percentage" ? (
                            <div className="flex items-center gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500">Taxa (%)</label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.1"
                                    disabled={!fee.is_enabled}
                                    value={fee.percentage_value ?? 2.0}
                                    onChange={(e) => handleSpecialFeeChange(idx, "percentage_value", e.target.value)}
                                    className="w-20 border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 disabled:bg-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                  />
                                  <span className="text-xs font-bold text-slate-500">%</span>
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-500">Mínimo (€)</label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.1"
                                    disabled={!fee.is_enabled}
                                    value={fee.min_value ?? 1.5}
                                    onChange={(e) => handleSpecialFeeChange(idx, "min_value", e.target.value)}
                                    className="w-20 border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 disabled:bg-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                  />
                                  <span className="text-xs font-bold text-slate-500">€</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500">Valor Fixo (€)</label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.1"
                                  disabled={!fee.is_enabled}
                                  value={fee.fixed_value ?? 0.0}
                                  onChange={(e) => handleSpecialFeeChange(idx, "fixed_value", e.target.value)}
                                  className="w-24 border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 disabled:bg-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                />
                                <span className="text-xs font-bold text-slate-500">€</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SUBTAB 3: TAXA COMBUSTÍVEL & DESCONTOS GERAIS */}
              {precarioSubTab === "geral" && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-5">
                  <div className="border-b border-slate-100 pb-3">
                    <h2 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-emerald-600" />
                      Ajustes Globais da Tabela de Preços
                    </h2>
                    <p className="text-[11px] text-slate-500">Definições aplicadas sobre o subtotal de todos os serviços de envio.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Nome da Tabela de Preço</label>
                      <input
                        type="text"
                        value={formData.pricing?.table_name || ""}
                        onChange={(e) => handlePricingConfigChange("table_name", e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        placeholder="Ex: Tabela Especial Têxtil 2026"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Taxa de Combustível Global (%)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          value={formData.pricing?.fuel_surcharge_pct ?? 12.5}
                          onChange={(e) => handlePricingConfigChange("fuel_surcharge_pct", parseFloat(e.target.value) || 0)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                        <span className="text-xs font-bold text-slate-600">%</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">Calculada sobre o frete base de cada envio.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Desconto Comercial Especial (%)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          value={formData.pricing?.discount_pct ?? 0}
                          onChange={(e) => handlePricingConfigChange("discount_pct", parseFloat(e.target.value) || 0)}
                          className="w-full border border-emerald-300 bg-emerald-50/40 rounded-lg px-3 py-2 text-xs font-mono font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                        <span className="text-xs font-bold text-emerald-700">%</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">Desconto bonificado aplicado na fatura.</p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}


        </div>

        {/* ===================== FOOTER BUTTONS ===================== */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {saveSuccessMsg && (
              <span className="text-emerald-600 font-bold flex items-center gap-1 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                Gravado com sucesso!
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>A gravar...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Gravar Cliente</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
