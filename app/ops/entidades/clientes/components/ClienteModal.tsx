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
  Image as ImageIcon,
  Edit3,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { saveClienteAction } from "@/app/actions/clientes"
import type { ServicoLinke, PriceTierLinke } from "@/app/ops/configuracao/servicos/types"
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
    billing_type: initialData?.billing_type || "conta_corrente",
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
    custom_tier_overrides: initialData?.custom_tier_overrides || {},
  })

  const [expandedPriceServico, setExpandedPriceServico] = React.useState<string | null>(null)
  const [isEditingCredit, setIsEditingCredit] = React.useState(false)

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
        billing_type: initialData.billing_type || "conta_corrente",
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
        custom_tier_overrides: initialData.custom_tier_overrides || {},
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

  const handleTierPriceChange = (
    servicoId: string,
    tierIndex: number,
    newSellPrice: number,
    baseTiers: PriceTierLinke[]
  ) => {
    setFormData((prev) => {
      const currentOverrides = prev.custom_tier_overrides?.[servicoId]
        ? [...prev.custom_tier_overrides[servicoId]]
        : baseTiers.map((t) => t.sell_price)

      while (currentOverrides.length < baseTiers.length) {
        currentOverrides.push(baseTiers[currentOverrides.length].sell_price)
      }

      currentOverrides[tierIndex] = newSellPrice

      return {
        ...prev,
        custom_tier_overrides: {
          ...(prev.custom_tier_overrides || {}),
          [servicoId]: currentOverrides,
        },
      }
    })
  }

  const handleResetServiceTiers = (servicoId: string) => {
    setFormData((prev) => {
      const nextOverrides = { ...(prev.custom_tier_overrides || {}) }
      delete nextOverrides[servicoId]
      return {
        ...prev,
        custom_tier_overrides: nextOverrides,
      }
    })
  }

  const handleResetPricing = () => {
    if (confirm("Deseja repor todos os preços de produtos CTT, serviços especiais e tabelas personalizadas para os valores padrão oficiais?")) {
      setFormData((prev) => ({
        ...prev,
        pricing: DEFAULT_CLIENT_PRICING,
        custom_tier_overrides: {},
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-[var(--surface-bg)] rounded-xl shadow-[var(--shadow-layer)] w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden border border-[var(--border-subtle)]">
        
        {/* ===================== OVERVIEW HEADER ===================== */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-bg)] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div 
              className="w-11 h-11 rounded-lg flex items-center justify-center text-white font-black text-base shadow-2xs shrink-0 overflow-hidden relative border border-[var(--border-subtle)]"
              style={{ backgroundColor: formData.color || "#10b981" }}
            >
              {formData.logo_url ? (
                <img 
                  src={formData.logo_url} 
                  alt={formData.short_name || "Logo"} 
                  className="w-full h-full object-cover bg-white"
                />
              ) : (
                formData.short_name ? formData.short_name.substring(0, 2).toUpperCase() : <Building2 className="w-5 h-5" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight truncate">
                  {formData.short_name || (initialData ? "Editar Cliente" : "Novo Cliente")}
                </h1>
                
                <span className="bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-[11px] font-mono font-bold px-2 py-0.5 rounded shrink-0">
                  {formData.code || "CL000"}
                </span>

                <span className="bg-[var(--accent-soft)] border border-[rgba(18,138,71,0.2)] text-[var(--accent)] text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0">
                  {formData.category || "Cliente Conta Corrente"}
                </span>
              </div>

              <div className="flex items-center gap-2.5 text-xs text-[var(--text-tertiary)] mt-0.5 truncate">
                <span className="text-[var(--text-secondary)] font-medium truncate">
                  {formData.legal_name || "Designação Social / Fiscal"}
                </span>
                <span>•</span>
                <span>NIF: <strong className="text-[var(--text-primary)] font-mono">{formData.nif || "—"}</strong></span>
                <span>•</span>
                <span className="text-[var(--accent)] font-semibold">
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
              className="px-3.5 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:scale-[0.99] text-white rounded-md text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
              title="Aceder à loja / portal do cliente para criar novos envios e pedidos"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Aceder à Loja (Criar Envios)</span>
              <span className="sm:hidden">Loja</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] rounded-md transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ===================== TABS NAVIGATION ===================== */}
        <div className="flex border-b border-[var(--border-subtle)] bg-[var(--surface-muted)]/70 px-4 sm:px-6 shrink-0 overflow-x-auto gap-1">
          {[
            { id: "geral", label: "Identidade & Geral", icon: Building2 },
            { id: "faturacao", label: "Moradas & Faturação", icon: MapPin },
            { id: "contactos", label: "Contactos", icon: Phone },
            { id: "comercial", label: "Condições & Crédito", icon: Euro },
            { id: "precario", label: "Tabelas de Preço & Serviços", icon: Percent, badge: `${(formData.assigned_linke_service_ids || []).length || servicosLinke.length} Tabelas` },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`py-2.5 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--surface-bg)] shadow-2xs rounded-t-md"
                    : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-bg)]/40 font-medium"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[var(--accent)]" : "text-[var(--text-tertiary)]"}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                    isActive ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface-dim)] text-[var(--text-secondary)]"
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ===================== FORM CONTENT ===================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[var(--canvas-bg)]">
          
          {/* TAB 1: IDENTIDADE & GERAL */}
          {activeTab === "geral" && (
            <div className="space-y-5 bg-[var(--surface-bg)] p-6 rounded-xl border border-[var(--border-subtle)] shadow-2xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Código Cliente *</label>
                  <input
                    type="text"
                    required
                    value={formData.code || ""}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-mono font-bold text-[var(--text-primary)] uppercase focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="CL001"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Designação Curta / Nome Comercial *</label>
                  <input
                    type="text"
                    required
                    value={formData.short_name || ""}
                    onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="Ex: CACTO ou DETAILER"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Designação Social / Razão Fiscal</label>
                  <input
                    type="text"
                    value={formData.legal_name || ""}
                    onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="Ex: Cacto Moda & Acessórios, Lda"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">NIF / Número Fiscal</label>
                  <input
                    type="text"
                    value={formData.nif || ""}
                    onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-mono font-semibold text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="514987123"
                  />
                </div>
              </div>

              {/* Foto / Logótipo da Marca ou Loja */}
              <div className="bg-[var(--surface-muted)]/50 border border-[var(--border-subtle)] rounded-xl p-4">
                <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Foto / Logótipo da Marca ou Loja</span>
                  <span className="text-[10px] text-[var(--text-tertiary)] font-normal normal-case">(Permite distinguir visualmente o cliente)</span>
                </label>
                <div className="flex flex-wrap items-center gap-4">
                  <div 
                    className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-2xs shrink-0 overflow-hidden border-2 relative"
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
                      <label className="px-3 py-1.5 bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md text-xs font-bold text-[var(--text-primary)] shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer">
                        <Upload className="w-3.5 h-3.5 text-[var(--accent)]" />
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
                          className="px-2.5 py-1.5 bg-[var(--status-critical-soft)] hover:bg-[var(--status-critical-soft)]/80 text-[var(--status-critical)] border border-[rgba(220,38,38,0.2)] rounded-md text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
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
                        className="w-full border border-[var(--border-subtle)] bg-[var(--surface-bg)] rounded-md px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:outline-none"
                      />
                    </div>

                    <p className="text-[11px] text-[var(--text-tertiary)]">
                      Formatos aceites: PNG, JPG, SVG ou WebP. A foto é usada no TMS, nos mapas e no portal deste cliente.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Categoria de Cliente</label>
                  <select
                    value={formData.category || "Cliente Conta Corrente"}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-semibold text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                  >
                    {DEFAULT_CLIENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Cor Identificadora no TMS</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.color || "#10b981"}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-9 h-9 p-0.5 rounded-md border border-[var(--border-subtle)] cursor-pointer bg-[var(--surface-muted)]"
                    />
                    <select
                      value={formData.color || "#10b981"}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    >
                      {CLIENT_COLOR_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>{c.label} ({c.value})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Observações Internas / Regras Operacionais</label>
                <textarea
                  rows={3}
                  value={formData.observations || ""}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  placeholder="Horários de recolha, exigências de etiquetagem, instruções para motoristas..."
                  className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md p-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="client_active"
                  checked={formData.is_active ?? true}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  disabled={formData.code === "CL001"}
                  title={formData.code === "CL001" ? "A Conta GO Linke (CL001) é protegida e não pode ser desativada." : undefined}
                  className="w-4 h-4 rounded border-[var(--border-strong)] accent-[var(--accent)] text-[var(--accent)] focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <label htmlFor="client_active" className={`text-xs font-bold cursor-pointer ${formData.code === "CL001" ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"}`}>
                  {formData.code === "CL001"
                    ? "🔒 Conta GO Linke — Protegida (não pode ser desativada)"
                    : "Cliente Ativo (Pode emitir guias e realizar envios)"}
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: MORADAS & FATURAÇÃO */}
          {activeTab === "faturacao" && (
            <div className="space-y-5 bg-[var(--surface-bg)] p-6 rounded-xl border border-[var(--border-subtle)] shadow-[var(--shadow-layer)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2.5">
                <MapPin className="w-4 h-4 text-[var(--accent)]" />
                Morada Principal e Agência de Faturação
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Morada / Rua</label>
                  <input
                    type="text"
                    value={formData.address || ""}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="Avenida Dom Afonso Henriques, 45"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Código Postal</label>
                  <input
                    type="text"
                    value={formData.postal_code || ""}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="4800-043"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Localidade / Cidade</label>
                  <input
                    type="text"
                    value={formData.city || ""}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="Guimarães"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">País</label>
                  <select
                    value={formData.country_code || "PT"}
                    onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-semibold text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all cursor-pointer"
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
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Agência de Faturação Linke</label>
                  <select
                    value={formData.billing_agency || "A01 - Sede Guimarães"}
                    onChange={(e) => setFormData({ ...formData, billing_agency: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-semibold text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="A01 - Sede Guimarães">A01 - Sede Guimarães</option>
                    <option value="A02 - Lisboa Oriente">A02 - Lisboa Oriente</option>
                    <option value="A03 - Porto Maia">A03 - Porto Maia</option>
                    <option value="A04 - Coimbra Sul">A04 - Coimbra Sul</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Email de Envio de Faturas</label>
                  <input
                    type="email"
                    value={formData.billing_email || ""}
                    onChange={(e) => setFormData({ ...formData, billing_email: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="financeiro@empresa.pt"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CONTACTOS */}
          {activeTab === "contactos" && (
            <div className="space-y-5 bg-[var(--surface-bg)] p-6 rounded-xl border border-[var(--border-subtle)] shadow-[var(--shadow-layer)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2.5">
                <Phone className="w-4 h-4 text-[var(--accent)]" />
                Pessoas de Contacto & Comunicação
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Nome do Responsável / Gestor na Empresa</label>
                  <input
                    type="text"
                    value={formData.manager_name || ""}
                    onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="Ex: Rui Barbosa"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Email Geral / Operacional</label>
                  <input
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="encomendas@empresa.pt"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Telefone Fixo</label>
                  <input
                    type="text"
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="253512345"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Telemóvel / WhatsApp</label>
                  <input
                    type="text"
                    value={formData.mobile_phone || ""}
                    onChange={(e) => setFormData({ ...formData, mobile_phone: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="912345678"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CONDIÇÕES & CRÉDITO */}
          {activeTab === "comercial" && (
            <div className="space-y-5 bg-[var(--surface-bg)] p-6 rounded-xl border border-[var(--border-subtle)] shadow-[var(--shadow-layer)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2.5">
                <Euro className="w-4 h-4 text-[var(--accent)]" />
                Condições Comerciais & Crédito
              </h2>

              {/* Tipo de Cliente / Modelo de Faturação */}
              <div>
                <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                  Modelo de Faturação / Tipo de Cliente
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Conta Corrente */}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, billing_type: "conta_corrente", category: "Cliente Conta Corrente" })}
                    className={`relative p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      (formData.billing_type || "conta_corrente") === "conta_corrente"
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]/50 shadow-xs ring-1 ring-[var(--accent)]/30"
                        : "border-[var(--border-subtle)] bg-[var(--surface-muted)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-bg)]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        (formData.billing_type || "conta_corrente") === "conta_corrente"
                          ? "bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30"
                          : "bg-[var(--surface-bg)] text-[var(--text-tertiary)] border border-[var(--border-subtle)]"
                      }`}>
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold ${
                          (formData.billing_type || "conta_corrente") === "conta_corrente" ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                        }`}>
                          Conta Corrente
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                          Faturação periódica (quinzenal ou mensal) com todos os envios. O cliente paga a prazo com base em extrato.
                        </p>
                      </div>
                      {(formData.billing_type || "conta_corrente") === "conta_corrente" && (
                        <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0 ml-auto" />
                      )}
                    </div>
                  </button>

                  {/* Pay as You Go */}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, billing_type: "pay_as_you_go", category: "Cliente Pré-Pagamento" })}
                    className={`relative p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      formData.billing_type === "pay_as_you_go"
                        ? "border-blue-500 bg-blue-50/50 shadow-xs ring-1 ring-blue-500/30"
                        : "border-[var(--border-subtle)] bg-[var(--surface-muted)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-bg)]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        formData.billing_type === "pay_as_you_go"
                          ? "bg-blue-100 text-blue-700 border border-blue-200"
                          : "bg-[var(--surface-bg)] text-[var(--text-tertiary)] border border-[var(--border-subtle)]"
                      }`}>
                        <Zap className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold ${
                          formData.billing_type === "pay_as_you_go" ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                        }`}>
                          Pay as You Go (Wallet)
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                          O cliente carrega saldo antecipadamente via Stripe. Os envios são debitados automaticamente do saldo disponível.
                        </p>
                      </div>
                      {formData.billing_type === "pay_as_you_go" && (
                        <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 ml-auto" />
                      )}
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Condição de Pagamento</label>
                  <select
                    value={formData.payment_terms || "A 30 dias"}
                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-semibold text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="Pronto Pagamento">Pronto Pagamento</option>
                    <option value="A 7 dias">A 7 dias (Semanal)</option>
                    <option value="A 15 dias">A 15 dias</option>
                    <option value="A 30 dias">A 30 dias</option>
                    <option value="A 45 dias">A 45 dias</option>
                    <option value="A 60 dias">A 60 dias</option>
                    <option value="A 90 dias">A 90 dias</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Crédito (€)</label>
                    <button 
                      type="button" 
                      onClick={() => setIsEditingCredit(!isEditingCredit)}
                      className="text-[10px] text-[var(--accent)] font-semibold hover:underline cursor-pointer"
                    >
                      {isEditingCredit ? "Bloquear edição" : "Editar manualmente"}
                    </button>
                  </div>
                  
                  {isEditingCredit ? (
                    <input
                      type="number"
                      value={formData.credit_limit ?? 5000}
                      onChange={(e) => setFormData({ ...formData, credit_limit: Number(e.target.value) })}
                      className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-mono font-bold text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                      placeholder="5000"
                    />
                  ) : (
                    <div className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-mono font-bold text-[var(--text-primary)] flex items-center justify-between">
                      <span>{Number(formData.credit_limit || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                      <span className="text-[10px] text-[var(--text-tertiary)] font-normal">Saldo (Pre-Pago)</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Comercial / Gestor de Conta</label>
                  <input
                    type="text"
                    value={formData.assigned_seller || ""}
                    onChange={(e) => setFormData({ ...formData, assigned_seller: e.target.value })}
                    className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-medium text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                    placeholder="Gestão Comercial Norte"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">IBAN para Débito Direto / Reembolsos</label>
                <input
                  type="text"
                  value={formData.iban || ""}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-mono font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                  placeholder="PT50 0033 0000 8765 4321 0987 1"
                />
              </div>
            </div>
          )}

          {/* TAB 5: PREÇÁRIO DE ENVIO (PRODUTOS & SERVIÇOS ESPECIAIS CTT) */}
          {activeTab === "precario" && (
            <div className="space-y-4">
              
              {/* Top Sub-Tab Switcher */}
              <div className="bg-[var(--surface-bg)] p-3 rounded-xl border border-[var(--border-subtle)] shadow-[var(--shadow-layer)] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 bg-[var(--surface-muted)] p-1 rounded-lg border border-[var(--border-subtle)] flex-wrap">
                  <button
                    type="button"
                    onClick={() => setPrecarioSubTab("servicos_linke")}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      precarioSubTab === "servicos_linke"
                        ? "bg-[var(--accent)] text-white shadow-xs"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>1. Atribuição de Tabelas Linke ({servicosLinke.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrecarioSubTab("produtos")}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      precarioSubTab === "produtos"
                        ? "bg-[var(--surface-bg)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>2. Tarifas por Escalão ({servicesList.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrecarioSubTab("suplementares")}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      precarioSubTab === "suplementares"
                        ? "bg-[var(--surface-bg)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>3. Taxas Especiais ({specialFeesList.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrecarioSubTab("geral")}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      precarioSubTab === "geral"
                        ? "bg-[var(--surface-bg)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                    <span>4. Combustível & Descontos</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetPricing}
                    className="px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                    <span>Repor Valores Padrão</span>
                  </button>
                </div>
              </div>

              {/* SUBTAB 0: TABELAS LINKE & SERVIÇOS AUTORIZADOS */}
              {precarioSubTab === "servicos_linke" && (
                <div className="space-y-4">
                  {/* Caixa Select de Tabela Linke Principal */}
                  <div className="bg-[var(--surface-bg)] p-5 rounded-xl border border-[var(--border-subtle)] shadow-[var(--shadow-layer)] space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-[var(--accent)]" />
                          <h3 className="font-bold text-sm text-[var(--text-primary)]">
                            Tabela de Preço Linke Atribuída ao Cliente
                          </h3>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                          Atribua manualmente a tabela tarifária que este cliente utilizará como base (ex: Standard, VIP, E-Commerce ou Negociada).
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
                          className="w-full px-3.5 py-2 bg-[var(--surface-muted)] border border-[var(--border-strong)] rounded-lg text-xs font-bold text-[var(--text-primary)] focus:bg-[var(--surface-bg)] focus:ring-1 focus:ring-[var(--border-strong)] focus:outline-none transition-all cursor-pointer"
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
                    <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-[var(--accent)]" />
                        <span className="text-[var(--text-secondary)]">
                          Perfil Selecionado: <strong className="text-[var(--text-primary)]">{formData.assigned_linke_profile || "Standard / Geral"}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[var(--text-secondary)] font-medium">Desconto de Volume Adicional:</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={formData.volume_discount_pct ?? 0}
                            onChange={(e) => setFormData({ ...formData, volume_discount_pct: parseFloat(e.target.value) || 0 })}
                            className="w-16 px-2 py-1 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded text-center text-xs font-mono font-bold text-[var(--accent)] focus:bg-[var(--surface-bg)] focus:outline-none"
                          />
                          <span className="font-bold text-[var(--text-secondary)]">%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Grid de Serviços Linke Autorizados */}
                  <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] shadow-[var(--shadow-layer)] overflow-hidden">
                    <div className="px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
                          Serviços Linke Autorizados para este Cliente ({formData.assigned_linke_service_ids?.length || 0} de {servicosLinke.length})
                        </h4>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          Marque os serviços e parceiros que este cliente tem permissão para usar ao criar envios.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {Object.keys(formData.custom_tier_overrides || {}).length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("Deseja repor todas as tabelas e escalões personalizados deste cliente para os valores originais dos Serviços Linke?")) {
                                setFormData((prev) => ({ ...prev, custom_tier_overrides: {} }))
                              }
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Repor Todos Escalões Linke
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, assigned_linke_service_ids: servicosLinke.map((s) => s.id) })}
                          className="px-2.5 py-1 text-[11px] font-bold bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30 rounded-md hover:bg-[var(--accent)] hover:text-white transition-colors cursor-pointer"
                        >
                          Selecionar Todos
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, assigned_linke_service_ids: [] })}
                          className="px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] rounded-md transition-colors cursor-pointer"
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
                        const tiers: PriceTierLinke[] = firstZone?.tiers || []
                        const tier1 = tiers[0]
                        const tier5 = tiers.find((t) => t.weight_max === 5) || tiers[1]
                        const isExpanded = expandedPriceServico === servico.id
                        const overrides = formData.custom_tier_overrides?.[servico.id]
                        const hasCustomPrices = !!(overrides && overrides.some((val, idx) => val !== undefined && tiers[idx] && Math.abs(val - tiers[idx].sell_price) > 0.001))

                        return (
                          <div
                            key={servico.id}
                            className={`rounded-xl border transition-all ${
                              isExpanded ? "col-span-1 md:col-span-2 shadow-sm ring-1 ring-[var(--accent)]/30" : "col-span-1 shadow-xs"
                            } ${
                              isAssigned
                                ? hasCustomPrices
                                  ? "bg-amber-50/20 border-amber-400"
                                  : "bg-[var(--accent-soft)]/40 border-[var(--accent)] ring-1 ring-[var(--accent)]/20"
                                : "bg-[var(--surface-bg)] border-[var(--border-subtle)] opacity-60 hover:opacity-100"
                            }`}
                          >
                            <div
                              onClick={() => {
                                const current = formData.assigned_linke_service_ids || []
                                const next = isAssigned
                                  ? current.filter((id) => id !== servico.id)
                                  : [...current, servico.id]
                                setFormData({ ...formData, assigned_linke_service_ids: next })
                              }}
                              className="p-3.5 flex items-start justify-between gap-3 cursor-pointer select-none"
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={isAssigned}
                                  onChange={() => {}} // Handled by div onClick
                                  className="mt-1 w-4 h-4 rounded border-[var(--border-strong)] accent-[var(--accent)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                                />

                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {carrierLogo ? (
                                      <div className="w-6 h-6 rounded bg-[var(--surface-bg)] border border-[var(--border-subtle)] p-0.5 flex items-center justify-center shrink-0 overflow-hidden">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={carrierLogo} alt={servico.preferred_carrier_name} className="max-w-full max-h-full object-contain" />
                                      </div>
                                    ) : null}
                                    <span className="font-bold text-xs text-[var(--text-primary)]">{servico.name}</span>
                                    {hasCustomPrices && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                                        <Edit3 className="w-2.5 h-2.5" />
                                        Preços Custom
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-mono text-[var(--text-tertiary)]">{servico.code}</span>
                                    <span className="text-[10px] font-semibold text-[var(--accent)] bg-[var(--accent-soft)] px-1.5 py-0.2 rounded border border-[var(--accent)]/20">
                                      {servico.pricing_profile}
                                    </span>
                                    <span className="text-[10px] text-[var(--text-tertiary)]">Trânsito: {servico.transit_time_label}</span>
                                  </div>

                                  {tier1 && !isExpanded && (
                                    <div className="mt-2 text-[11px] text-[var(--text-secondary)] flex items-center gap-2 font-mono flex-wrap">
                                      {(() => {
                                         const price1 = overrides?.[0] ?? tier1.sell_price
                                         const is1Custom = overrides?.[0] !== undefined && Math.abs(overrides[0] - tier1.sell_price) > 0.001
                                         const price5 = tier5 ? (overrides?.[tiers.indexOf(tier5)] ?? tier5.sell_price) : null
                                         return (
                                           <>
                                             <span>
                                               Até 1kg:{" "}
                                               <strong className={is1Custom ? "text-amber-800 font-bold" : "text-[var(--accent)] font-bold"}>
                                                 {price1.toFixed(2)}€
                                               </strong>
                                               {is1Custom && (
                                                 <span className="text-[9px] text-[var(--text-tertiary)] line-through ml-1">
                                                   {tier1.sell_price.toFixed(2)}€
                                                 </span>
                                               )}
                                             </span>
                                             {tier5 && price5 !== null && (
                                               <span>
                                                 • Até 5kg:{" "}
                                                 <strong className="text-[var(--accent)] font-bold">
                                                   {price5.toFixed(2)}€
                                                 </strong>
                                               </span>
                                             )}
                                           </>
                                         )
                                       })()}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                {isAssigned && tiers.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setExpandedPriceServico(isExpanded ? null : servico.id)
                                    }}
                                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-all flex items-center gap-1.5 cursor-pointer ${
                                      isExpanded
                                        ? "bg-[var(--text-primary)] text-white border-[var(--text-primary)]"
                                        : hasCustomPrices
                                        ? "bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200"
                                        : "bg-[var(--surface-bg)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                                    }`}
                                    title="Editar ou personalizar preços dos escalões deste serviço para este cliente"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    <span>{isExpanded ? "Fechar Tabela" : hasCustomPrices ? "Ajustar Preços ✎" : "Ajustar Preços"}</span>
                                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  </button>
                                )}

                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isAssigned ? "bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30" : "bg-[var(--surface-muted)] text-[var(--text-tertiary)] border border-[var(--border-subtle)]"
                                }`}>
                                  {isAssigned ? "Autorizado" : "Bloqueado"}
                                </span>
                              </div>
                            </div>

                            {/* Expanded Price Override Table */}
                            {isExpanded && isAssigned && (
                              <div
                                className="p-4 bg-[var(--surface-bg)] border-t border-[var(--border-subtle)] rounded-b-xl space-y-3"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--border-subtle)]">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1 rounded bg-[var(--accent-soft)] text-[var(--accent)]">
                                      <Tag className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                      <span className="text-xs font-bold text-[var(--text-primary)]">
                                        Personalização dos Escalões de Peso: {servico.name}
                                      </span>
                                      <p className="text-[11px] text-[var(--text-secondary)]">
                                        Altere diretamente o PVP Cliente (€) em cada escalão. Se deixar o valor padrão, a tarifa segue a tabela Linke.
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {hasCustomPrices && (
                                      <button
                                        type="button"
                                        onClick={() => handleResetServiceTiers(servico.id)}
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                        Repor Padrão Linke
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="bg-[var(--surface-muted)] border-b border-[var(--border-subtle)] text-[var(--text-secondary)] font-semibold text-[11px]">
                                        <th className="py-2 px-3">Escalão</th>
                                        <th className="py-2 px-3 text-center">Peso Máx</th>
                                        <th className="py-2 px-3 text-right">Custo Parceiro</th>
                                        <th className="py-2 px-3 text-right">PVP Standard Linke</th>
                                        <th className="py-2 px-3 text-right bg-[var(--accent-soft)]/50 text-[var(--text-primary)] border-x border-[var(--border-subtle)]">
                                          PVP Cliente (€) <span className="text-[var(--accent)] font-normal">(Editável)</span>
                                        </th>
                                        <th className="py-2 px-3 text-right">Margem Bruta</th>
                                        <th className="py-2 px-3 text-center">Estado</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-subtle)]">
                                      {tiers.map((tier, tIdx) => {
                                        const currentVal = overrides?.[tIdx] !== undefined ? overrides[tIdx] : tier.sell_price
                                        const isOverridden = overrides?.[tIdx] !== undefined && Math.abs(overrides[tIdx] - tier.sell_price) > 0.001
                                        const marginEur = currentVal - tier.cost_price
                                        const marginPct = currentVal > 0 ? (marginEur / currentVal) * 100 : 0

                                        return (
                                          <tr key={tier.id || tIdx} className={`hover:bg-[var(--surface-muted)]/60 transition-colors ${isOverridden ? "bg-amber-50/40" : ""}`}>
                                            <td className="py-2 px-3 font-semibold text-[var(--text-primary)]">
                                              {tier.label || `Escalão ${tIdx + 1}`}
                                            </td>
                                            <td className="py-2 px-3 text-center font-mono text-[var(--text-secondary)]">
                                              ≤ {tier.weight_max} kg
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono text-[var(--text-tertiary)]">
                                              {tier.cost_price.toFixed(2)}€
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono text-[var(--text-secondary)]">
                                              {tier.sell_price.toFixed(2)}€
                                            </td>
                                            <td className="py-1.5 px-3 text-right bg-[var(--accent-soft)]/30 border-x border-[var(--border-subtle)]">
                                              <div className="flex items-center justify-end gap-1">
                                                <input
                                                  type="number"
                                                  step="0.01"
                                                  min="0"
                                                  value={currentVal}
                                                  onChange={(e) => {
                                                    const val = parseFloat(e.target.value) || 0
                                                    handleTierPriceChange(servico.id, tIdx, val, tiers)
                                                  }}
                                                  className={`w-24 text-right font-mono font-bold text-xs px-2 py-1 rounded-md border shadow-2xs focus:ring-1 focus:ring-[var(--border-strong)] focus:outline-none transition-all ${
                                                    isOverridden
                                                      ? "border-amber-400 bg-amber-50/90 text-amber-950 ring-1 ring-amber-400/40"
                                                      : "border-[var(--border-subtle)] bg-[var(--surface-bg)] text-[var(--text-primary)] focus:border-[var(--border-strong)]"
                                                  }`}
                                                />
                                                <span className="text-xs font-semibold text-[var(--text-secondary)]">€</span>
                                              </div>
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono">
                                              <span className={marginEur >= 0 ? "text-[var(--accent)] font-semibold" : "text-rose-600 font-bold"}>
                                                {marginEur >= 0 ? "+" : ""}{marginEur.toFixed(2)}€
                                              </span>
                                              <span className="text-[10px] text-[var(--text-tertiary)] block">
                                                ({marginPct.toFixed(1)}%)
                                              </span>
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                              {isOverridden ? (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                                  <Edit3 className="w-2.5 h-2.5" />
                                                  Custom
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                                                  Standard
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {servicosLinke.length === 0 && (
                        <div className="col-span-2 p-8 text-center text-[var(--text-tertiary)] text-xs">
                          Nenhum serviço Linke configurado. Configure serviços em Configuração &gt; Serviços Linke.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SUBTAB 1: PRODUTOS & SUB-PRODUTOS CTT */}
              {precarioSubTab === "produtos" && (
                <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] shadow-[var(--shadow-layer)] overflow-hidden">
                  <div className="px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] flex items-center justify-between">
                    <div>
                      <h2 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Truck className="w-4 h-4 text-[var(--accent)]" />
                        Tabela de Preços por Produto & Sub-Produto de Transporte (Valores em € sem IVA)
                      </h2>
                      <p className="text-[11px] text-[var(--text-secondary)]">Defina a tarifa por escalão de peso para cada serviço contratado pelo cliente.</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-[var(--surface-muted)] border-b border-[var(--border-subtle)] text-[var(--text-secondary)] font-bold text-[11px]">
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
                      <tbody className="divide-y divide-[var(--border-subtle)] font-mono">
                        {servicesList.map((srv, idx) => (
                          <tr 
                            key={srv.service_code} 
                            className={`transition-colors ${srv.is_enabled ? "hover:bg-[var(--surface-muted)]/60" : "bg-[var(--surface-muted)]/30 opacity-60"}`}
                          >
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={srv.is_enabled}
                                onChange={() => handleToggleProductService(idx)}
                                className="w-4 h-4 rounded border-[var(--border-strong)] accent-[var(--accent)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                              />
                            </td>

                            <td className="py-2.5 px-3 font-sans">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-[var(--text-primary)]">{srv.service_name}</span>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full font-sans ${
                                    srv.category === "Nacional" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                                    srv.category === "Ilhas" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                    srv.category === "Espanha" ? "bg-rose-50 text-rose-700 border border-rose-200" :
                                    srv.category === "Postal" ? "bg-purple-50 text-purple-700 border border-purple-200" :
                                    "bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30"
                                  }`}>
                                    {srv.category}
                                  </span>
                                </div>
                                <span className="text-[10px] text-[var(--text-tertiary)] font-normal line-clamp-1">{srv.description}</span>
                              </div>
                            </td>

                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="0.01"
                                disabled={!srv.is_enabled}
                                value={srv.w_0_1}
                                onChange={(e) => handleProductPriceChange(idx, "w_0_1", e.target.value)}
                                className="w-full text-center border border-[var(--border-subtle)] rounded px-1.5 py-1 text-xs font-bold text-[var(--text-primary)] bg-[var(--surface-bg)] disabled:bg-[var(--surface-muted)] focus:ring-1 focus:ring-[var(--border-strong)] focus:outline-none"
                              />
                            </td>

                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="0.01"
                                disabled={!srv.is_enabled}
                                value={srv.w_1_2}
                                onChange={(e) => handleProductPriceChange(idx, "w_1_2", e.target.value)}
                                className="w-full text-center border border-[var(--border-subtle)] rounded px-1.5 py-1 text-xs font-bold text-[var(--text-primary)] bg-[var(--surface-bg)] disabled:bg-[var(--surface-muted)] focus:ring-1 focus:ring-[var(--border-strong)] focus:outline-none"
                              />
                            </td>

                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="0.01"
                                disabled={!srv.is_enabled}
                                value={srv.w_2_5}
                                onChange={(e) => handleProductPriceChange(idx, "w_2_5", e.target.value)}
                                className="w-full text-center border border-[var(--border-subtle)] rounded px-1.5 py-1 text-xs font-bold text-[var(--text-primary)] bg-[var(--surface-bg)] disabled:bg-[var(--surface-muted)] focus:ring-1 focus:ring-[var(--border-strong)] focus:outline-none"
                              />
                            </td>

                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="0.01"
                                disabled={!srv.is_enabled}
                                value={srv.w_5_10}
                                onChange={(e) => handleProductPriceChange(idx, "w_5_10", e.target.value)}
                                className="w-full text-center border border-[var(--border-subtle)] rounded px-1.5 py-1 text-xs font-bold text-[var(--text-primary)] bg-[var(--surface-bg)] disabled:bg-[var(--surface-muted)] focus:ring-1 focus:ring-[var(--border-strong)] focus:outline-none"
                              />
                            </td>

                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="0.01"
                                disabled={!srv.is_enabled}
                                value={srv.w_10_20}
                                onChange={(e) => handleProductPriceChange(idx, "w_10_20", e.target.value)}
                                className="w-full text-center border border-[var(--border-subtle)] rounded px-1.5 py-1 text-xs font-bold text-[var(--text-primary)] bg-[var(--surface-bg)] disabled:bg-[var(--surface-muted)] focus:ring-1 focus:ring-[var(--border-strong)] focus:outline-none"
                              />
                            </td>

                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="0.01"
                                disabled={!srv.is_enabled}
                                value={srv.w_20_30}
                                onChange={(e) => handleProductPriceChange(idx, "w_20_30", e.target.value)}
                                className="w-full text-center border border-[var(--border-subtle)] rounded px-1.5 py-1 text-xs font-bold text-[var(--text-primary)] bg-[var(--surface-bg)] disabled:bg-[var(--surface-muted)] focus:ring-1 focus:ring-[var(--border-strong)] focus:outline-none"
                              />
                            </td>

                            <td className="py-2 px-1.5">
                              <input
                                type="number"
                                step="0.01"
                                disabled={!srv.is_enabled}
                                value={srv.kg_extra}
                                onChange={(e) => handleProductPriceChange(idx, "kg_extra", e.target.value)}
                                className="w-full text-center border border-[var(--border-subtle)] rounded px-1.5 py-1 text-xs font-bold text-[var(--text-primary)] bg-[var(--surface-muted)] disabled:bg-[var(--surface-muted)] focus:ring-1 focus:ring-[var(--border-strong)] focus:outline-none"
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
                <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] shadow-[var(--shadow-layer)] overflow-hidden">
                  <div className="px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] flex items-center justify-between">
                    <div>
                      <h2 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        Tabela de Taxas Suplementares e Serviços Especiais (SpecialServices API CTT)
                      </h2>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Valores cobrados ao cliente quando adiciona opções especiais de entrega aos seus envios.
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-[var(--border-subtle)]">
                    {specialFeesList.map((fee, idx) => (
                      <div 
                        key={fee.special_service_code}
                        className={`p-4 flex flex-wrap items-center justify-between gap-4 transition-colors ${
                          fee.is_enabled ? "hover:bg-[var(--surface-muted)]/60" : "bg-[var(--surface-muted)]/30 opacity-60"
                        }`}
                      >
                        <div className="flex items-start gap-3 max-w-lg">
                          <input
                            type="checkbox"
                            checked={fee.is_enabled}
                            onChange={(e) => handleSpecialFeeChange(idx, "is_enabled", e.target.checked)}
                            className="w-4 h-4 mt-1 rounded border-[var(--border-strong)] accent-[var(--accent)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-[var(--text-primary)]">{fee.special_service_name}</span>
                              <span className="text-[10px] font-mono bg-[var(--surface-muted)] text-[var(--text-secondary)] px-1.5 py-0.2 rounded border border-[var(--border-subtle)]">
                                Tipo {fee.api_type_code}
                              </span>
                            </div>
                            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{fee.description}</p>
                          </div>
                        </div>

                        {/* Input controls based on fee type */}
                        <div className="flex items-center gap-3">
                          {fee.fee_type === "percentage" ? (
                            <div className="flex items-center gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-[var(--text-secondary)]">Taxa (%)</label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.1"
                                    disabled={!fee.is_enabled}
                                    value={fee.percentage_value ?? 2.0}
                                    onChange={(e) => handleSpecialFeeChange(idx, "percentage_value", e.target.value)}
                                    className="w-20 border border-[var(--border-subtle)] rounded px-2 py-1 text-xs font-mono font-bold text-[var(--text-primary)] bg-[var(--surface-bg)] disabled:bg-[var(--surface-muted)] focus:ring-1 focus:ring-[var(--border-strong)] focus:outline-none"
                                  />
                                  <span className="text-xs font-bold text-[var(--text-secondary)]">%</span>
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-[var(--text-secondary)]">Mínimo (€)</label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.1"
                                    disabled={!fee.is_enabled}
                                    value={fee.min_value ?? 1.5}
                                    onChange={(e) => handleSpecialFeeChange(idx, "min_value", e.target.value)}
                                    className="w-20 border border-[var(--border-subtle)] rounded px-2 py-1 text-xs font-mono font-bold text-[var(--text-primary)] bg-[var(--surface-bg)] disabled:bg-[var(--surface-muted)] focus:ring-1 focus:ring-[var(--border-strong)] focus:outline-none"
                                  />
                                  <span className="text-xs font-bold text-[var(--text-secondary)]">€</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label className="block text-[10px] font-bold text-[var(--text-secondary)]">Valor Fixo (€)</label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.1"
                                  disabled={!fee.is_enabled}
                                  value={fee.fixed_value ?? 0.0}
                                  onChange={(e) => handleSpecialFeeChange(idx, "fixed_value", e.target.value)}
                                  className="w-24 border border-[var(--border-subtle)] rounded px-2 py-1 text-xs font-mono font-bold text-[var(--text-primary)] bg-[var(--surface-bg)] disabled:bg-[var(--surface-muted)] focus:ring-1 focus:ring-[var(--border-strong)] focus:outline-none"
                                />
                                <span className="text-xs font-bold text-[var(--text-secondary)]">€</span>
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
                <div className="bg-[var(--surface-bg)] p-6 rounded-xl border border-[var(--border-subtle)] shadow-[var(--shadow-layer)] space-y-5">
                  <div className="border-b border-[var(--border-subtle)] pb-3">
                    <h2 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-[var(--accent)]" />
                      Ajustes Globais da Tabela de Preços
                    </h2>
                    <p className="text-[11px] text-[var(--text-secondary)]">Definições aplicadas sobre o subtotal de todos os serviços de envio.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Nome da Tabela de Preço</label>
                      <input
                        type="text"
                        value={formData.pricing?.table_name || ""}
                        onChange={(e) => handlePricingConfigChange("table_name", e.target.value)}
                        className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                        placeholder="Ex: Tabela Especial Têxtil 2026"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Taxa de Combustível Global (%)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          value={formData.pricing?.fuel_surcharge_pct ?? 12.5}
                          onChange={(e) => handlePricingConfigChange("fuel_surcharge_pct", parseFloat(e.target.value) || 0)}
                          className="w-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] rounded-md px-3 py-2 text-xs font-mono font-bold text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--border-strong)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                        />
                        <span className="text-xs font-bold text-[var(--text-secondary)]">%</span>
                      </div>
                      <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Calculada sobre o frete base de cada envio.</p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Desconto Comercial Especial (%)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          value={formData.pricing?.discount_pct ?? 0}
                          onChange={(e) => handlePricingConfigChange("discount_pct", parseFloat(e.target.value) || 0)}
                          className="w-full border border-[var(--accent)]/40 bg-[var(--accent-soft)]/40 rounded-md px-3 py-2 text-xs font-mono font-bold text-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:bg-[var(--surface-bg)] focus:outline-none transition-all"
                        />
                        <span className="text-xs font-bold text-[var(--accent)]">%</span>
                      </div>
                      <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Desconto bonificado aplicado na fatura.</p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}


        </div>

        {/* ===================== FOOTER BUTTONS ===================== */}
        <div className="px-6 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--surface-bg)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            {saveSuccessMsg && (
              <span className="text-[var(--accent)] font-bold flex items-center gap-1 animate-in fade-in">
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
              className="px-4 py-2 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSaving}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold px-5 py-2 rounded-lg text-xs shadow-sm flex items-center gap-2 transition-all cursor-pointer"
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
